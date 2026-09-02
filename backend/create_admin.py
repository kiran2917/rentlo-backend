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
    user.is_staff = True
    user.is_superuser = True
    user.save()
    print(f"Superuser '{username}' created successfully.")
else:
    user = User.objects.get(username=username)
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    roles = list(user.roles or [])
    if 'admin' not in roles:
        roles.append('admin')
    user.roles = roles
    user.set_password(password)
    user.save()
    print(f"User '{username}' successfully updated with admin role, superuser privileges, and password reset.")
