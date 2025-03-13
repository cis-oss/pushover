import https from "node:https";
import { URLSearchParams } from "node:url";

export interface PushoverMessage {
  message: string;
  title?: string;
  link?: {
    url: string;
    title?: string;
  };
  priority?: -2 | -1 | 0 | 1 | 2;
  sound?: string;
  timestamp?: number;
  html?: 0 | 1;
  monospace?: 0 | 1;
  ttl?: number;
}

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
    Object.entries(message).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === "link") {
          if (typeof value === "string") {
            params.append("url", value);
            return;
          }
          params.append("url", value.url);
          if (value.title) {
            params.append("url_title", value.title);
          }
          return;
        }
        params.append(key, value.toString());
      }
    });

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
