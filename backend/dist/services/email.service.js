"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class EmailService {
    /**
     * Sends an email via Nodemailer using dynamic SMTP transporter options.
     * Returns SMTP metadata (messageId) and Ethereal preview URLs if applicable.
     */
    static async sendEmail(params) {
        const transporter = nodemailer_1.default.createTransport({
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
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        return {
            messageId: info.messageId,
            previewUrl,
        };
    }
}
exports.EmailService = EmailService;
