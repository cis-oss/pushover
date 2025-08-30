import https from "node:https";
import { URLSearchParams } from "node:url";
import { z } from "zod";

/**
 * @internal
 * Defines the internal Zod schema for validating Pushover message payloads.
 * This ensures messages conform to the Pushover API requirements before sending.
 * Includes validation rules for required fields, formats, and conditional requirements.
 */
const MessageSchema = z
  .object({
    /**
     * The message content sent to the user. Must be at least 3 characters long.
     */
    message: z.string().min(3),
    /**
     * An optional title for the message.
     */
    title: z.string().optional(),
    /**
     * An optional link attached to the message.
     * Can be either a simple URL string or an object containing the URL and an optional display title.
     */
    link: z
      .string()
      .url()
      .or(
        z.object({
          /**
           * The URL of the link.
           */
          url: z.string().url(),
          /**
           * The title displayed for the link.
           */
          title: z.string().optional(),
        }),
      )
      .optional(),
    /**
     * Sets the notification priority for the message.
     * Defaults to 0 (normal priority).
     *
     * - -2: Message only, no notification sound/vibration. May increment the notification bubble.
     * - -1: Silent notification (no sound/vibration).
     * - 0: Default notification behavior.
     * - 1: High priority, ignores user's quiet hours.
     * - 2: Emergency priority, requires acknowledgement. Requires `emergencyOpts`.
     */
    priority: z
      .union([
        z.literal(-2),
        z.literal(-1),
        z.literal(0),
        z.literal(1),
        z.literal(2),
      ])
      .optional()
      .default(0),
    /**
     * Emergency priority options, required when `priority` is 2.
     */
    emergencyOpts: z
      .object({
        /**
         * Specifies how often (in seconds) the Pushover servers will send the same notification to the user.
         * Minimum value is 30 seconds.
         */
        retry: z.number().min(30),
        /**
         * Specifies how long (in seconds) the notification will continue to be resent.
         * Maximum value is 10800 seconds (3 hours).
         */
        expire: z.number().max(10800),
        /**
         * An optional callback URL that Pushover servers will send a request to when the notification has been acknowledged.
         */
        callback: z.string().url().optional(),
        /**
         * Optional tags for emergency notifications. Helps with cancelling retries.
         */
        tags: z.string().array().optional(),
      })
      .optional(),
    /**
     * The name of one of the predefined Pushover sounds or a custom sound uploaded by the user to be played for the notification.
     */
    sound: z.string().optional(),
    /**
     * An optional Unix timestamp representing the message's date and time to display to the user, rather than the time Pushover received it.
     */
    timestamp: z.number().optional(),
    /**
     * If set to true, the message content will be treated as HTML.
     * Mutually exclusive with `monospace`.
     */
    html: z.boolean().optional().default(false),
    /**
     * If set to true, the message content will be displayed using a monospace font.
     * Mutually exclusive with `html`.
     */
    monospace: z.boolean().optional().default(false),
    /**
     * Time To Live in seconds. Specifies how long the message will be kept until disappearing.
     */
    ttl: z.number().optional(),
  })
  /**
   * Validation rule: Ensures that if the priority is set to 2 (emergency),
   * the `emergencyOpts` object must be provided.
   */
  .refine(
    (data) => {
      // If priority is 2, emergencyOpts must exist.
      return !(data.priority === 2 && !data.emergencyOpts);
    },
    {
      path: ["priority", "emergencyOpts"], // Path related to the error
      message: "If priority is set to 2, emergencyOpts must be included.",
    },
  )
  /**
   * Validation rule: Ensures that `html` and `monospace` formatting options
   * are mutually exclusive and cannot be enabled simultaneously.
   */
  .refine(
    (data) => {
      // Cannot have both html and monospace set to true.
      return !(data.html && data.monospace);
    },
    {
      path: ["html", "monospace"], // Path related to the error
      message: "html and monospace are mutually exclusive.",
    },
  );

/**
 * Defines the structure for a Pushover message object used when calling the `send` method.
 *
 * This type represents the complete set of parameters you can provide for a
 * Pushover notification. It includes the required `message` field and various
 * optional fields to customize the notification's appearance, behavior, priority,
 * sound, and delivery options.
 *
 * Refer to the official Pushover API documentation for detailed explanations of each field.
 * Note the specific constraints:
 * - `emergencyOpts` must be provided if `priority` is set to `2`.
 * - `html` and `monospace` formatting options cannot be used together.
 *
 * @example
 * ```typescript
 * import type { PushoverMessage } from '@cis-oss/pushover';
 *
 * const standardMessage: PushoverMessage = {
 *   message: "Deployment successful!",
 *   title: "Server Update",
 *   priority: 1, // High priority
 *   sound: "pushover",
 *   link: {
 *     url: "https://example.com/deployment/status",
 *     title: "View Status"
 *   }
 * };
 *
 * const emergencyMessage: PushoverMessage = {
 *   message: "System critical: Service down!",
 *   priority: 2,
 *   emergencyOpts: {
 *     retry: 60, // Retry every 60 seconds
 *     expire: 3600 // Expire after 1 hour
 *     tags: ["critical", "infra"]
 *   },
 * };
 * ```
 */
export type PushoverMessage = z.input<typeof MessageSchema>;

type PushoverMessageParsed = z.output<typeof MessageSchema>;

/**
 * Base interface for all Pushover API responses
 */
interface PushoverResponse {
  /** Indicates the status of the request. `1` for success, `0` for failure. */
  status: 0 | 1;
  /** A unique identifier for the API request, generated by Pushover. */
  request: string;
  /** An array of error messages if the request failed (`status` is `0`). */
  errors?: string[];
}

/**
 * Represents the response received after successfully sending a Pushover message.
 */
export interface PushoverMessageResponse extends PushoverResponse {
  /**
   * A receipt ID, returned only for messages sent with emergency priority (`priority: 2`).
   * This ID can be used to check the acknowledgement status or cancel retries.
   */
  receipt?: string;
}

/**
 * Represents the response received after validating a user or user/device combination.
 */
export interface PushoverValidationResponse extends PushoverResponse {
  /** A list of the user's registered device names, returned on successful validation. */
  devices?: string[];
  /** A list of the user's Pushover license types (e.g., 'Android', 'iOS', 'Desktop'). */
  licenses?: string[];
}

/**
 * Represents the response received when checking the status of an emergency message receipt.
 */
export interface PushoverReceiptResponse extends PushoverResponse {
  /** `true` if the emergency notification has been acknowledged by the user, `false` otherwise. */
  acknowledged: boolean;
  /** A Unix timestamp indicating when the notification was acknowledged. `0` if not acknowledged. */
  acknowledged_at: number;
  /** The user key of the user who first acknowledged the notification. Empty if not acknowledged. */
  acknowledged_by: string;
  /** The name of the device that first acknowledged the notification. Empty if not acknowledged. */
  acknowledged_by_device: string;
  /** A Unix timestamp indicating the last time the notification was delivered (due to retries). `0` if not delivered. */
  last_delivered_at: number;
  /** `true` if the notification has expired without acknowledgement, `false` otherwise. */
  expired: boolean;
  /** A Unix timestamp indicating when the notification expired. `0` if not expired. */
  expired_at: number;
  /** `true` if the optional callback URL was successfully contacted, `false` otherwise. */
  called_back: boolean;
  /** A Unix timestamp indicating when the callback URL was contacted. `0` if not called back. */
  called_back_at: number;
}

/**
 * Represents the response received when cancelling emergency message retries by tag.
 */
export interface PushoverTagCancellationResponse extends PushoverResponse {
  /** The number of emergency message retries that were successfully cancelled for the given tag. */
  canceled: number;
}

/**
 * Defines the options for the `send` method, primarily specifying the recipients.
 */
export interface SendOptions {
  /** An array of `PushoverRecipient` objects, each specifying a user/group and optional devices. */
  recipients: PushoverRecipient[];
  /** If true, enables verbose logging to the console during the send operation. Defaults to false. */
  verbose?: boolean;
}

/**
 * Defines the options for the `validate` method.
 */
export interface ValidateOptions {
  /** The Pushover user key to validate. */
  user: string;
  /** An optional device name to validate along with the user key. */
  deviceName?: string;
  /** If true, enables verbose logging to the console during the send operation. Defaults to false. */
  verbose?: boolean;
}

/**
 * Represents a single Pushover recipient, which can be a user or a group.
 */
export interface PushoverRecipient {
  /** The Pushover user key or group key. */
  id: string;
  /** An optional array of specific device names belonging to the user to send the notification to. If omitted, sends to all user's devices. */
  devices?: string[];
}

/**
 * Main class for interacting with the Pushover API (v1).
 * Provides methods for sending notifications, validating users/devices,
 * and managing emergency priority messages.
 *
 * @param token - Your Pushover application's API token.
 *
 * @example
 * ```typescript
 * import { Pushover } from '@cis-oss/pushover';
 *
 * // Initialize the client
 * const pushover = new Pushover('YOUR_APP_API_TOKEN');
 *
 * // Define recipients
 * const recipients = [{ id: 'USER_KEY_1' }, {id: 'USER_KEY_2', devices: ['DEVICE_1', 'DEVICE_2']}, { id: 'GROUP_KEY_1' }];
 *
 * // Send a basic message
 * const responses = pushover.send({
 *     message: "Hello from the library!",
 *     title: "Test Message"
 *   }, { recipients });
 *
 * responses.then((responses) => {
 *   console.log('Messages sent:', responses);
 * }).catch( (error) => {
 *   console.error('Failed to send messages:', error);
 * })
 * ```
 */
export class Pushover {
  private token: string;
  private apiUrl = "https://api.pushover.net/1/";

  /**
   * Creates an instance of the Pushover client.
   * @param token - Your Pushover application's API token. Found on your Pushover dashboard.
   */
  constructor(token: string) {
    this.token = token;
  }

  /**
   * Sends a Pushover notification to one or more recipients.
   *
   * @param message - A `PushoverMessage` object containing the notification details.
   * @param options - A `SendOptions` object specifying the recipients and optional settings.
   * @returns A Promise resolving to an array of `PushoverMessageResponse` objects, one for each recipient.
   *          Rejects if message validation fails or if there's a fundamental issue sending to all recipients.
   *          Individual recipient failures are indicated within their respective response objects (`status: 0`).
   *
   * @example
   * ```typescript
   * // Send a message to a specific user and device
   * const userRecipient: PushoverRecipient = { id: "user-key", devices: ["phone"] };
   * await pushover.send({ message: "Targeted message" }, { recipients: [userRecipient] });
   *
   * // Send an emergency priority message and handle the receipt
   * const responses = pushover.send({
   *   message: "Emergency alert!",
   *   priority: 2,
   *   emergencyOpts: { retry: 30, expire: 3600 }
   * }, { recipients: [userRecipient] });
   *
   * responses.then((responses) => {
   *   console.log(`Emergency message sent. Receipts: ${responses.map((response) => response.receipt).join(", ")}`);
   *   // Store the receipt to check status or cancel later
   * }).catch((error) => {
   *   console.error("Failed to send emergency message:", error);
   * });
   * ```
   */
  public async send(
    message: PushoverMessage,
    options: SendOptions,
  ): Promise<PushoverMessageResponse[]> {
    return new Promise((resolve, reject) => {
      if (options.recipients.length === 0) {
        reject(new Error("No recipients specified."));
      }

      const {
        success,
        error,
        data: parsedMessage,
      } = MessageSchema.safeParse(message);

      if (!success) {
        reject(new Error(`Message validation failed: ${error}`));
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
        this.sendToSingleRecipient(
          parsedMessage,
          recipient,
          options.verbose ?? false,
        ),
      );

      resolve(Promise.all(promises));
    });
  }

  /**
   * @internal
   * Sends the validated message payload to a single recipient.
   *
   * @param message - The validated PushoverMessage object.
   * @param recipient - The PushoverRecipient object.
   * @param verbose - Optional flag for logging.
   * @returns A Promise resolving to the PushoverMessageResponse.
   */
  private async sendToSingleRecipient(
    message: PushoverMessageParsed,
    recipient: PushoverRecipient,
    verbose?: boolean,
  ): Promise<PushoverMessageResponse> {
    const params = new URLSearchParams();

    // Add token and user
    params.append("token", this.token);
    params.append("user", recipient.id);
    params.append("device", recipient.devices?.join(",") ?? "");

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

    return this.makeRequest<PushoverMessageResponse>(
      "messages.json",
      "POST",
      params,
      verbose ?? false,
    );
  }

  /**
   * @internal
   * Makes an HTTPS request to the Pushover API.
   *
   * @param endpoint - The API endpoint path (e.g., "messages.json").
   * @param method - The HTTP method ("POST" or "GET").
   * @param params - URLSearchParams for POST body or query string.
   * @param verbose - Optional flag for logging request/response details.
   * @returns A Promise resolving to the parsed JSON response.
   */
  private makeRequest<T extends PushoverResponse>(
    endpoint: string,
    method: "POST" | "GET",
    params: URLSearchParams,
    verbose?: boolean,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = this.apiUrl + endpoint;
      let requestBody: string | null = null;
      let requestUrl = url;

      const options: https.RequestOptions = {
        method: method,
        headers: {},
      };

      if (method === "POST") {
        requestBody = params.toString();
        options.headers!["Content-Type"] = "application/x-www-form-urlencoded";
        options.headers!["Content-Length"] = Buffer.byteLength(requestBody);
      } else {
        // Append params to URL for GET requests
        const queryString = params.toString();
        if (queryString) {
          requestUrl += "?" + queryString;
        }
      }

      if (verbose) {
        console.log(`Making ${method} request to ${requestUrl}`);
        if (requestBody) {
          console.log("Request Body:", requestBody);
        }
      }

      const req = https.request(requestUrl, options, (res) => {
        let data = "";
        res.setEncoding("utf8"); // Ensure correct encoding

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (verbose) {
            console.log("Received response status:", res.statusCode);
            console.log("Received response headers:", res.headers);
            console.log(
              `Received response body (length: ${data.length}): ${data}`,
            );
          }
          try {
            // Handle potential empty responses or non-JSON responses gracefully
            if (!data) {
              // Reject promise on empty response
              reject(
                new Error(
                  `Request failed with status ${res.statusCode} and empty response.`,
                ),
              );
              return;
            }

            const response = JSON.parse(data) as T;
            // Basic check for expected structure
            if (
              typeof response.status === "undefined" ||
              typeof response.request === "undefined"
            ) {
              reject(new Error(`Invalid response structure received: ${data}`));
              return;
            }

            resolve(response);
          } catch (error) {
            if (verbose) console.error("Failed to parse JSON response:", error);
            reject(
              new Error(`Failed to parse API response. Raw data: ${data}`),
            );
          }
        });
      });

      req.on("error", (error) => {
        if (verbose)
          console.error(`HTTPS request error to ${endpoint}:`, error);
        reject(new Error(`API request failed: ${error.message}`));
      });

      if (method === "POST" && requestBody) {
        req.write(requestBody);
      }

      req.end();
    });
  }

  /**
   * Validates a Pushover user key and optionally a specific device name associated with that user.
   * Useful for verifying recipient details before sending messages.
   *
   * @param options - A `ValidateOptions` object containing the `user` key and optional `deviceName`.
   * @returns A Promise resolving to a `PushoverValidationResponse` object.
   *          Check the `status` field (1 for valid, 0 for invalid) and `errors` for details on failure.
   *          On success, `devices` and `licenses` may be populated.
   *
   * @example
   * ```typescript
   * // Validate a user key
   * const validation = await pushover.validate({ user: "user-key" });
   * if (validation.status === 1) {
   *   console.log("User is valid. Devices:", validation.devices, ", Licenses:", validation.licenses);
   * } else {
   *   console.error("Validation failed:", validation.errors);
   * }
   *
   * // Validate a user and device
   * const deviceValidation = await pushover.validate({ user: "user-key", deviceName: "phone" });
   * console.log("Device validation status:", deviceValidation.status);
   * ```
   */
  validate(options: ValidateOptions): Promise<PushoverValidationResponse> {
    const params = new URLSearchParams();

    params.append("token", this.token);
    params.append("user", options.user);
    if (options.deviceName) params.append("device", options.deviceName);

    return this.makeRequest<PushoverValidationResponse>(
      "users/validate.json",
      "POST",
      params,
      options.verbose ?? false,
    );
  }

  /**
   * Checks the status of an emergency priority message using its receipt ID.
   * Allows querying whether the message has been acknowledged, expired, or if the callback was triggered.
   *
   * @param receipt - The receipt ID obtained from the `PushoverMessageResponse` when sending an emergency message.
   * @param verbose - Optional flag for logging.
   * @returns A Promise resolving to a `PushoverReceiptResponse` object containing the status details.
   *
   * @example
   * ```typescript
   * const receiptId = "RECEIPT_ID_FROM_SEND_RESPONSE";
   * const status = await pushover.checkReceipt(receiptId);
   * if (status.status === 1) {
   *   console.log(`Acknowledged: ${status.acknowledged} by ${status.acknowledged_by}`);
   *   console.log(`Expired: ${status.expired}`);
   * } else {
   *   console.error("Failed to check receipt:", status.errors);
   * }
   * ```
   */
  checkReceipt(
    receipt: string,
    verbose?: boolean,
  ): Promise<PushoverReceiptResponse> {
    const params = new URLSearchParams();
    return this.makeRequest<PushoverReceiptResponse>(
      `receipts/${receipt}.json?token=${this.token}`,
      "GET",
      params,
      verbose ?? false,
    );
  }

  /**
   * Cancels the retries for an emergency priority message that has not yet been acknowledged.
   *
   * @param receipt - The receipt ID of the emergency message whose retries should be cancelled.
   * @param verbose - Optional flag for logging.
   * @returns A Promise resolving to a basic `PushoverResponse`. Check `status` for success (1) or failure (0).
   *
   * @example
   * ```typescript
   * const receiptId = "RECEIPT_ID_TO_CANCEL";
   * const cancelResponse = await pushover.cancelRetries(receiptId);
   * if (cancelResponse.status === 1) {
   *   console.log("Successfully cancelled retries for receipt:", receiptId);
   * } else {
   *   console.error("Failed to cancel retries:", cancelResponse.errors);
   * }
   * ```
   */
  cancelRetries(receipt: string, verbose?: boolean): Promise<PushoverResponse> {
    const params = new URLSearchParams();
    params.append("token", this.token);
    return this.makeRequest<PushoverResponse>(
      `receipts/${receipt}/cancel.json`,
      "POST",
      params,
      verbose ?? false,
    );
  }

  /**
   * Cancels the retries for all emergency priority messages associated with a specific tag
   * that have not yet been acknowledged.
   *
   * @param tag - The tag associated with the emergency messages (set in `emergencyOpts.tags` during send).
   * @param verbose - Optional flag for logging.
   * @returns A Promise resolving to a `PushoverTagCancellationResponse` indicating the number of messages cancelled.
   *
   * @example
   * ```typescript
   * const tagName = "critical-db-alert";
   * const cancelByTagResponse = await pushover.cancelRetriesByTag(tagName);
   * if (cancelByTagResponse.status === 1) {
   *   console.log(`Successfully cancelled ${cancelByTagResponse.canceled} messages with tag: ${tagName}`);
   * } else {
   *   console.error("Failed to cancel by tag:", cancelByTagResponse.errors);
   * }
   * ```
   */
  cancelRetriesByTag(
    tag: string,
    verbose?: boolean,
  ): Promise<PushoverTagCancellationResponse> {
    const params = new URLSearchParams();
    params.append("token", this.token);
    return this.makeRequest<PushoverTagCancellationResponse>(
      `receipts/cancel_by_tag/${tag}.json`,
      "POST",
      params,
      verbose ?? false,
    );
  }
}
