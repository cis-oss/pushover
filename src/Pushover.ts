import https from "node:https";
import { URLSearchParams } from "node:url";
import { z } from "zod";

const MessageSchema = z
  .object({
    /**
     * The message sent to the user.
     */
    message: z.string().min(3),
    /**
     * An optional title.
     */
    title: z.string().optional(),
    /**
     * A link attached to the message.
     * Can be either the link or an object containing the link and an optional title.
     */
    link: z
      .string()
      .url()
      .or(
        z.object({
          /**
           * The url of the link
           */
          url: z.string().url(),
          /**
           * The title displayed as the link
           */
          title: z.string().optional(),
        }),
      )
      .optional(),
    /**
     * Sets notification setting for the message.
     *
     * -2: Message only, no notification. May increment notification bubble.
     * -1: Silent notification
     * 0: default notification
     * 1: ignores user's quiet hours.
     * 2: requires acknowledgement
     */
    priority: z
      .union([
        z.literal(-2),
        z.literal(-1),
        z.literal(0),
        z.literal(1),
        z.literal(2),
      ])
      .default(0),
    emergencyOpts: z
      .object({
        retry: z.number().min(30),
        expire: z.number().max(10800),
        callback: z.string().url().optional(),
        tags: z.string().array().optional(),
      })
      .optional(),
    sound: z.string().optional(),
    timestamp: z.number().optional(),
    html: z.boolean().optional().default(false),
    monospace: z.boolean().optional().default(false),
    ttl: z.number().optional(),
  })
  .refine(
    (data) => {
      if (data.priority == 2 && !data.emergencyOpts) return false;
      return true;
    },
    {
      path: ["priority", "emergencyOpts"],
      message: "If priority is set to 2, emergencyOpts must be included.",
    },
  )
  .refine(
    (data) => {
      return !(data.html && data.monospace);
    },
    {
      path: ["html", "monospace"],
      message: "html and monospace are mutually exclusive.",
    },
  );

export type PushoverMessage = z.input<typeof MessageSchema>;

type PushoverMessageParsed = z.output<typeof MessageSchema>;

interface PushoverResponse {
  status: number;
  request: string;
}

export interface PushoverMessageResponse extends PushoverResponse {
  errors?: string[];
  receipt?: string;
}

export interface PushoverValidationResponse extends PushoverResponse {
  devices?: string[];
  licenses?: string[];
}

export interface PushoverReceiptResponse extends PushoverResponse {
  acknowledged: boolean;
  acknowledged_at: number;
  acknowledged_by: string;
  acknowledged_by_device: string;
  last_delivered_at: number;
  expired: boolean;
  expired_at: number;
  called_back: boolean;
  called_back_at: number;
}

export interface PushoverTagCancellationResponse extends PushoverResponse {
  canceled: number;
}

export interface SendOptions {
  recipients: PushoverUser[];
  verbose?: boolean;
}

export interface PushoverUser {
  id: string;
  devices?: string[];
}

export interface ValidateOptions {
  user: string;
  deviceName?: string;
}

export class Pushover {
  private token: string;
  private apiUrl = "https://api.pushover.net/1/";

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Send a notification to one or multiple recipients
   */
  public async send(
    message: PushoverMessage,
    options: SendOptions,
  ): Promise<PushoverMessageResponse[]> {
    return new Promise((resolve, reject) => {
      if (options.recipients.length === 0) {
        reject("No recipients specified.");
      }

      const {
        success,
        error,
        data: parsedMessage,
      } = MessageSchema.safeParse(message);

      if (!success) {
        reject(`Message validation failed: ${error}`);
        return;
      }

      if (options.verbose) {
        console.log("Verbose mode enabled. Logging message and options:");
        console.log(parsedMessage);
        console.log(options);
        console.log("----------------------");
        console.log("Sending message...");
      }

      const promises = options.recipients.map((recipient) =>
        this.sendToSingleRecipient(parsedMessage, recipient),
      );

      resolve(Promise.all(promises));
    });
  }

  private async sendToSingleRecipient(
    message: PushoverMessageParsed,
    user: PushoverUser,
  ): Promise<PushoverMessageResponse> {
    const params = new URLSearchParams();

    // Add token and user
    params.append("token", this.token);
    params.append("user", user.id);
    params.append("device", user.devices?.join(",") ?? "");

    // Add message properties
    params.append("message", message.message);
    if (message.title) params.append("title", message.title);
    params.append("priority", "" + message.priority);
    if (message.priority === 2 && message.emergencyOpts) {
      params.append("retry", String(message.emergencyOpts.retry));
      params.append("expire", String(message.emergencyOpts.expire));
      if (message.emergencyOpts.callback)
        params.append("callback", message.emergencyOpts.callback);
      if (message.emergencyOpts.tags)
        params.append("tags", message.emergencyOpts.tags.join());
    }
    if (message.link) {
      if (typeof message.link === "string") {
        params.append("url", message.link);
      } else {
        params.append("url", message.link.url);
        if (message.link.title) params.append("url_title", message.link.title);
      }
    }
    if (message.html) params.append("html", "1");
    if (message.monospace) params.append("monospace", "1");
    if (message.sound) params.append("sound", message.sound);
    if (message.timestamp)
      params.append("timestamp", String(message.timestamp));
    if (message.ttl) params.append("ttl", String(message.ttl));

    return this.makeRequest("messages.json", "POST", params);
  }

  private makeRequest(
    url: string,
    method: "POST" | "GET",
    params: URLSearchParams,
  ): Promise<PushoverResponse> {
    return new Promise((resolve, reject) => {
      const options = {
        method: method,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      const req = https.request(this.apiUrl + url, options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data) as PushoverResponse;
            resolve(response);
          } catch (error) {
            console.error(error);
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(params.toString());
      req.end();
    });
  }

  /**
   * Validate a user and device.
   *
   * If only user is provided, it will validate the user and return.
   */
  validate(options: ValidateOptions): Promise<PushoverValidationResponse> {
    const params = new URLSearchParams();

    params.append("token", this.token);
    params.append("user", options.user ?? "");
    if (options.deviceName) params.append("device", options.deviceName);

    return this.makeRequest("users/validate.json", "POST", params);
  }

  checkReceipt(receipt: string): Promise<PushoverReceiptResponse> {
    const params = new URLSearchParams();
    return this.makeRequest(
      `receipts/${receipt}.json?token=${this.token}`,
      "GET",
      params,
    ) as Promise<PushoverReceiptResponse>;
  }

  cancelRetries(receipt: string): Promise<PushoverResponse> {
    const params = new URLSearchParams();
    params.append("token", this.token);
    return this.makeRequest(`receipts/${receipt}/cancel.json`, "POST", params);
  }

  cancelRetriesByTag(tag: string): Promise<PushoverTagCancellationResponse> {
    const params = new URLSearchParams();
    params.append("token", this.token);
    return this.makeRequest(
      `receipts/cancel_by_tag/${tag}.json`,
      "POST",
      params,
    ) as Promise<PushoverTagCancellationResponse>;
  }
}
