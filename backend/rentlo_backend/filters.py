import logging
import re

class PIIScrubbingFilter(logging.Filter):
    """
    A custom logging filter that redacts sensitive PII from log messages.
    """
    
    # Regex patterns for sensitive data
    PATTERNS = [
        # Match Indian phone numbers (with or without +91)
        (re.compile(r'(\+91[-.\s]?)?[6-9]\d{9}'), '<REDACTED_PHONE>'),
        # Match Razorpay tokens / Order IDs roughly
        (re.compile(r'(rzp_(test|live)_[a-zA-Z0-9]+)'), '<REDACTED_RZP_KEY>'),
        (re.compile(r'(pay_[a-zA-Z0-9]+)'), '<REDACTED_PAYMENT_ID>'),
        # Match basic email patterns
        (re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'), '<REDACTED_EMAIL>'),
    ]

    def filter(self, record):
        if isinstance(record.msg, str):
            for pattern, replacement in self.PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)
        return True
