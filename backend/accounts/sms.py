import random
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class SMSProvider:
    """Abstract provider interface. Implement send(phone, message) in real provider."""

    def send(self, phone: str, message: str):
        raise NotImplementedError


class DevStubProvider(SMSProvider):
    def send(self, phone: str, message: str):
        # In dev we just log the message
        logger.info(f"[SMS-STUB] To={phone} Message={message}")
        # Return a fake message id
        return {'status': 'sent', 'id': f'dev-{int(datetime.utcnow().timestamp())}'}


# Twilio provider using Messages API (sends custom message containing the OTP)
try:
    import requests
except Exception:
    requests = None


class TwilioProvider(SMSProvider):
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        if not requests:
            raise RuntimeError('requests library is required for TwilioProvider')
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self.url = f'https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'

    def send(self, phone: str, message: str):
        data = {'From': self.from_number, 'To': phone, 'Body': message}
        resp = requests.post(self.url, data=data, auth=(self.account_sid, self.auth_token), timeout=10) # type: ignore
        resp.raise_for_status()
        return resp.json()


# Convenience: generate numeric OTP

def generate_otp(length=6):
    return ''.join(str(random.randint(0, 9)) for _ in range(length))
