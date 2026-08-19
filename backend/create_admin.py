import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rentlo_backend.settings')
django.setup()

from accounts.models import User

username = os.getenv('ADMIN_USERNAME', 'admin')
email = os.getenv('ADMIN_EMAIL', 'admin@rentlo.com')
password = os.getenv('ADMIN_PASSWORD', 'Admin@123')

if not User.objects.filter(username=username).exists():
    user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password
    )
    user.roles = ['admin']
    user.is_phone_verified = True
    user.save()
    print(f"Superuser '{username}' created successfully.")
else:
    print(f"Superuser '{username}' already exists.")
