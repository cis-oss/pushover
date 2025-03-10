import { z } from "zod";

const messageSchema = z.object({
  /**
   * The message to send.
   */
  message: z.string(),
  /**
   * The title of the message.
   */
  title: z.string().optional(),
  /**
   * The URL to open when the notification is clicked.
   */
  url: z
    .object({
      /**
       * The URL itself.
       */
      url: z.string(),
      /**
       * The title of the URL to be displayed.
       */
      title: z.string().optional(),
    })
    .optional(),
  priority: z
    .object({
      level: z.number().default(0),
      retry: z.number().optional(),
      expire: z.number().optional(),
      callback: z.string().optional(),
    })
    .optional(),
  sound: z.string().optional(),
  timestamp: z.date().optional(),
  html: z.boolean().default(false),
  attachment: z
    .object({
      data: z.string().or(z.instanceof(File)),
      type: z.string(),
    })
    .optional(),
  users: z.array(
    z.object({
      name: z.string(),
      token: z.string(),
      devices: z.array(z.string()),
    }),
  ),
  appToken: z.string(),
});

export type PushoverMessage = z.infer<typeof messageSchema>;

export type Pushover = {
  // #################################
  // #            Helpers            #
  // #################################

  /**
   * Get all available sounds.
   */
  getSounds: () => { sounds: string[] };

  /**
   * Get all available devices for a user.
   */
  getDevices: (userToken: string) => { devices: string[] };

  // #################################
  // #            Sending            #
  // #################################

  /**
   * Send the notification.
   */
  send: () => void;

  // #################################
  // #            Options            #
  // #################################
  withMessage: (message: string) => Pushover;
  withTitle: (title: string) => Pushover;
  withUrl: (url: { url: string; title: string }) => Pushover;
  withPriority: (priority: {
    level: number;
    retry?: number;
    expire?: number;
    callback?: string;
  }) => Pushover;
  withSound: (sound: string) => Pushover;
  withTimestamp: (timestamp: number) => Pushover;
  withHtml: (enable: boolean) => Pushover;
  withAttachment: (attachment: File) => Pushover;
  withBase64Attachment: (attachment: {
    data: string;
    type: string;
  }) => Pushover;
  addUsers: (users: User[]) => Pushover;
};

export type User = {
  name: string;
  token: string;
  devices: string[];
};

console.log(
  "this is indented obnoxiously far and has no semi at the end. (testing previous commits",
);
