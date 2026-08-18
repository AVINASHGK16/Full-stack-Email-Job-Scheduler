import nodemailer from 'nodemailer';

export class EmailService {
  /**
   * Sends an email via Nodemailer using dynamic SMTP transporter options.
   * Returns SMTP metadata (messageId) and Ethereal preview URLs if applicable.
   */
  public static async sendEmail(params: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<{ messageId: string; previewUrl: string | false }> {
    const transporter = nodemailer.createTransport({
      host: params.host,
      port: params.port,
      secure: params.port === 465,
      auth: {
        user: params.user,
        pass: params.pass,
      },
    });

    const info = await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: params.body.replace(/\n/g, '<br>'),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl,
    };
  }
}
