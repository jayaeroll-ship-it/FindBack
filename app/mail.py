from email.message import EmailMessage
from pathlib import Path
import smtplib
import time
from email.parser import BytesParser
from email import policy
from .models import uid


def send_reset(settings, email, raw_token, test_mail):
    link = settings.public_origin + "/reset-password?token=" + raw_token
    message = EmailMessage()
    message["Subject"] = "Reset your FindBack password"
    message["From"] = settings.smtp_from or "local-dev@findback.invalid"
    message["To"] = email
    message.set_content(f"Use this link within 30 minutes to reset your password:\n{link}\n\nIf you did not request this, ignore this message.")
    if settings.environment == "test":
        test_mail.append({"email": email, "token": raw_token})
    elif not settings.smtp_host and settings.environment == "development":
        # Backend-only local mailbox; never served over HTTP or printed in logs.
        outbox = Path("data/dev-mail")
        outbox.mkdir(parents=True, exist_ok=True)
        (outbox / (uid() + ".eml")).write_text(message.as_string(), encoding="utf-8")
    else:
        # Durable backend-only queue prevents delivery outages revealing account existence.
        outbox = Path("data/email-outbox")
        outbox.mkdir(parents=True, exist_ok=True)
        path = outbox / (uid() + ".eml")
        path.write_bytes(message.as_bytes())
        path.chmod(0o600)


def deliver_pending(settings):
    if not settings.smtp_host:
        return
    outbox = Path("data/email-outbox")
    if not outbox.exists():
        return
    for path in list(outbox.glob("*.eml"))[:20]:
        if time.time() - path.stat().st_mtime > 1800:
            path.unlink(missing_ok=True)
            continue
        message = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                if settings.smtp_starttls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
            path.unlink(missing_ok=True)
        except (smtplib.SMTPException, OSError):
            print("Reset email delivery unavailable; private queue retained until credential expiry.")
            break
