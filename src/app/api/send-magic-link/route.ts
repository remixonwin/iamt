/**
 * Send Magic Link API Route
 * 
 * Sends email verification or password recovery magic links
 * using Resend email service.
 */

import { NextRequest, NextResponse } from 'next/server';

// Email sender address (must be verified in Resend)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@iamt.app';

interface MagicLinkRequest {
    email: string;
    magicLink?: string;
    type: 'verification' | 'recovery';
}

// Lazy-load Resend to avoid build errors when API key is not set
async function getResendClient() {
    if (!process.env.RESEND_API_KEY) {
        return null;
    }
    const { Resend } = await import('resend');
    return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: NextRequest) {
    try {
        const body: MagicLinkRequest = await request.json();
        const { email, magicLink, type } = body;

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Check if Resend is configured
        const resend = await getResendClient();
        if (!resend) {
            console.warn('[MagicLink] RESEND_API_KEY not configured, logging email instead');
            console.log(`[MagicLink] Would send ${type} email to ${email}: ${magicLink}`);
            
            return NextResponse.json({
                success: true,
                message: 'Email logged (Resend not configured)',
            });
        }

        // Build email content based on type
        const subject = type === 'verification'
            ? 'Verify your IAMT email address'
            : 'Reset your IAMT password';

        const html = type === 'verification'
            ? `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #6366f1;">Verify Your Email</h1>
                    <p>Click the button below to verify your email address and complete your IAMT account setup.</p>
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
                        Verify Email
                    </a>
                    <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
                    <p style="color: #666; font-size: 14px;">If you didn't create an account, you can ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                    <p style="color: #999; font-size: 12px;">IAMT - Decentralized File Storage</p>
                </div>
            `
            : `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #6366f1;">Reset Your Password</h1>
                    <p>Click the button below to reset your IAMT password.</p>
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
                        Reset Password
                    </a>
                    <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
                    <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can ignore this email. Your password will remain unchanged.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                    <p style="color: #999; font-size: 12px;">IAMT - Decentralized File Storage</p>
                </div>
            `;

        // Send email via Resend
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject,
            html,
        });

        if (error) {
            console.error('[MagicLink] Resend error:', error);
            return NextResponse.json(
                { error: 'Failed to send email' },
                { status: 500 }
            );
        }

        console.log(`[MagicLink] Sent ${type} email to ${email}, id: ${data?.id}`);

        return NextResponse.json({
            success: true,
            message: 'Email sent successfully',
        });
    } catch (error) {
        console.error('[MagicLink] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
