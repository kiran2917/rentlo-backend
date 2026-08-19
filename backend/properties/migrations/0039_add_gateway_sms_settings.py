from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("properties", "0038_alter_platformsettings_buyer_theme_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformsettings",
            name="razorpay_key_id",
            field=models.CharField(blank=True, default="", help_text="Razorpay Key ID (e.g. rzp_test_... or rzp_live_...)", max_length=100),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="razorpay_key_secret",
            field=models.CharField(blank=True, default="", help_text="Razorpay Key Secret", max_length=255),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="razorpay_webhook_secret",
            field=models.CharField(blank=True, default="", help_text="Razorpay Webhook Secret", max_length=255),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="sms_provider",
            field=models.CharField(
                choices=[
                    ("none", "None (Demo mode)"),
                    ("exotel", "Exotel"),
                    ("twilio", "Twilio"),
                    ("msg91", "MSG91"),
                    ("fast2sms", "Fast2SMS"),
                    ("textlocal", "TextLocal"),
                ],
                default="none",
                help_text="Active SMS gateway for OTP delivery",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="sms_api_key",
            field=models.CharField(blank=True, default="", help_text="API Key / Account SID for SMS provider", max_length=255),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="sms_api_secret",
            field=models.CharField(blank=True, default="", help_text="API Secret / Auth Token", max_length=255),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="sms_sender_id",
            field=models.CharField(blank=True, default="", help_text="Sender ID (e.g. RENTLO)", max_length=20),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="sms_template_id",
            field=models.CharField(blank=True, default="", help_text="DLT Template ID for MSG91/Fast2SMS", max_length=50),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="sms_from_number",
            field=models.CharField(blank=True, default="", help_text="Twilio From phone number", max_length=20),
        ),
    ]
