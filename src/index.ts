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
        repeat: z.number().min(30),
        expire: z.number().max(10800),
        callback: z.string().url().optional(),
        tags: z.string().array().optional(),
      })
      .optional(),
    sound: z.string().optional(),
    timestamp: z.number().optional(),
    html: z.boolean().default(false),
    monospace: z.boolean().default(false),
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
      if (data.html && data.monospace) return false;
      return true;
    },
    {
      path: ["html", "monospace"],
      message: "html and monospace are mutually exclusive.",
    },
  );

export type PushoverMessage = z.infer<typeof MessageSchema>;

// export interface PushoverMessage {
//   message: string;
//   title?: string;
//   link?: {
//     url: string;
//     title?: string;
//   } | string;
//   priority: -2 | -1 | 0 | 1 | 2;
//   sound?: string;
//   timestamp?: number;
//   html: boolean;
//   monospace: boolean;
//   ttl?: number;
// }

export interface PushoverResponse {
  status: number;
  request: string;
  errors?: string[];
}

export interface PushoverConfig {
  token: string;
  defaultUser?: string;
}

export interface SendOptions {
  recipients?: string | string[];
  device?: string | string[];
  verbose?: boolean;
}

export class Pushover {
  private token: string;
  private defaultUser?: string;
  private apiUrl = "https://api.pushover.net/1/messages.json";

  constructor(config: PushoverConfig) {
    this.token = config.token;
    this.defaultUser = config.defaultUser;
  }

  /**
   * Send a notification to one or multiple recipients
   */
  public async send(
    message: PushoverMessage,
    options: SendOptions = {},
  ): Promise<PushoverResponse[]> {
    const recipients = this.getRecipients(options);

    console.log(MessageSchema.parse(message));

    if (recipients.length === 0) {
      throw new Error(
        "No recipients specified. Provide recipients in options or set a defaultUser.",
      );
    }

    if (options.verbose) {
      console.log("Verbose mode enabled. Logging message and options:");
      console.log(message);
      console.log(options);
      console.log("----------------------");
      console.log("Sending message...");
    }

    const promises = recipients.map((recipient) =>
      this.sendToSingleRecipient(message, recipient, options.device),
    );

    const results = await Promise.all(promises);

    // Combine results
    const combinedResponse: PushoverResponse[] = results.map(
      (result) => result,
    );

    return combinedResponse;
  }

  private getRecipients(options: SendOptions): string[] {
    const { recipients } = options;

    if (recipients) {
      return Array.isArray(recipients) ? recipients : [recipients];
    }

    return this.defaultUser ? [this.defaultUser] : [];
  }

  private async sendToSingleRecipient(
    message: PushoverMessage,
    user: string,
    device?: string | string[],
  ): Promise<PushoverResponse> {
    const params = new URLSearchParams();

    // Add token and user
    params.append("token", this.token);
    params.append("user", user);

    // Add message properties
    params.append("message", message.message);
    if (message.title) params.append("title", message.title);
    params.append("priority", "" + message.priority);
    if (message.priority === 2 && message.emergencyOpts) {
      params.append("repeat", String(message.emergencyOpts.repeat));
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
        if (message.link.title) params.append("title", message.link.title);
      }
    }
    if (message.html) params.append("html", "1");
    if (message.monospace) params.append("monospace", "1");
    if (message.sound) params.append("sound", message.sound);
    if (message.timestamp)
      params.append("timestamp", String(message.timestamp));
    if (message.ttl) params.append("ttl", String(message.ttl));

    // Add device if specified
    if (device) {
      if (Array.isArray(device)) {
        params.append("device", device.join(","));
      } else {
        params.append("device", device);
      }
    }

    return this.makeRequest(params);
  }

  private makeRequest(params: URLSearchParams): Promise<PushoverResponse> {
    return new Promise((resolve, reject) => {
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      const req = https.request(this.apiUrl, options, (res) => {
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
}
