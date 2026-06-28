import nodemailer, { Transporter } from 'nodemailer';
import { MailOptions } from 'nodemailer/lib/json-transport';
import cron from 'node-cron'
import { Options } from 'nodemailer/lib/mailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
class CronPro  {
load(){
    cron.createTask('**/6***', ()=>{})
}
}

// Use environment variables for security (e.g., process.env.GMAIL_USER, process.env.GMAIL_APP_PASSWORD)

// Define a type for our template functions
type EmailTemplate = (data: any) => string;

 export const htmlTemplates: Record<string, EmailTemplate> = {
    // 1. Monthly Stats Template
    monthy: (data: { username: string, month: string, score: number }) => `
        <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h1 style="color: #2c3e50;">${data.month} Quiz Report</h1>
            <p>Hi <strong>${data.username}</strong>,</p>
            <p>Great job this month! Here are your stats for ${data.month}:</p>
            <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #3498db;">
                <p style="margin: 0;">Total Score: <span style="font-size: 20px; color: #3498db;">${data.score} pts</span></p>
                <p style="margin: 0; font-size: 12px; color: #777;">Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            <p>Keep up the great work!</p>
        </div>
    `,

    // 2. Password Reset Template
    resetPassword: (data: { username: string, resetLink: string }) => `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
            <h2 style="color: #e74c3c;">Reset Your Password</h2>
            <p>Hello ${data.username}, we received a request to reset your password.</p>
            <p>Click the button below to secure your account:</p>
            <a href="${data.resetLink}" style="display: inline-block; padding: 12px 25px; background-color: #e74c3c; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
            <p style="font-size: 12px; color: #999; margin-top: 20px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
    `,

    // 3. Email Change Template
    changeEmail: (data: { username: string, oldEmail: string, newEmail: string }) => `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2c3e50;">Email Change Request</h2>
            <p>Hi ${data.username},</p>
            <p>You are requesting to change your email from <strong>${data.oldEmail}</strong> to <strong>${data.newEmail}</strong>.</p>
            <p>Please confirm this change to continue.</p>
            <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; font-size: 12px;">
                Request date: ${new Date().toLocaleString()}
            </div>
        </div>
    `,

    // 4. Confirm Account/Email Template
    confirmEmail: (data: { username: string, confirmLink: string }) => `
        <div style="font-family: Arial, sans-serif; text-align: center; background-color: #f4f7f6; padding: 50px;">
            <div style="background: white; padding: 30px; display: inline-block; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #27ae60;">Welcome, ${data.username}!</h2>
                <p>Please verify your email address to start quizzing.</p>
                <a href="${data.confirmLink}" style="display: inline-block; padding: 10px 20px; background-color: #27ae60; color: white; text-decoration: none; border-radius: 5px;">Verify My Account</a>
            </div>
        </div>
    `
};

export class Email {
    public  templates:Record<string, EmailTemplate>;
    private transporter: Transporter<SMTPTransport.SentMessageInfo>;
    constructor(email:string, password:string, templates= htmlTemplates){
        this.templates = templates
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: email,
                pass:password
            }
        });

    }
     
   
    async send({to, subject}:{subject:string, to:string}, html:string){
        const mailOptions: MailOptions = {
            from: `Quizzing App <${process.env.MY_EMAIL}>`, // Pro: Use a "Friendly" name
            to,
            subject,
            html,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent: ' + info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            // Pro: Log to a service like Sentry instead of just console
            console.error('Mail Error:', error);
            return { success: false, error };
        }

    };
    

}