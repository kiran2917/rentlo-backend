import re
from django.core.management.base import BaseCommand
from django.db.models import Q
from properties.models import Property
from accounts.models import User

class Command(BaseCommand):
    help = 'Ensures all properties with owner_phone have an active User owner account with valid login credentials.'

    def add_arguments(self, parser):
        parser.add_argument('--default-password', type=str, default='rentlo@123', help='Default password to set if user is newly created or reset requested')
        parser.add_argument('--phone', type=str, help='Specific phone number to sync or reset')
        parser.add_argument('--password', type=str, help='Specific password to set for the phone')

    def handle(self, *args, **options):
        default_pwd = options.get('default_password')
        target_phone = options.get('phone')
        custom_pwd = options.get('password')

        if target_phone:
            clean = re.sub(r'\D', '', target_phone)
            if len(clean) >= 10:
                clean = clean[-10:]
            pwd = custom_pwd or default_pwd
            user = User.objects.filter(Q(phone=clean) | Q(phone__endswith=clean)).first()
            if not user:
                user = User.objects.create_user(
                    username=f"owner_{clean}",
                    phone=clean,
                    password=pwd,
                    roles=['owner'],
                    is_phone_verified=True,
                    first_name="Property Owner"
                )
                self.stdout.write(self.style.SUCCESS(f"Created new owner User with phone {clean} and password: {pwd}"))
            else:
                roles = list(user.roles or [])
                if 'owner' not in roles:
                    roles.append('owner')
                    user.roles = roles
                user.set_password(pwd)
                user.is_phone_verified = True
                user.is_active = True
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Updated existing User {user.username} (phone: {clean}) with password: {pwd} and owner role"))

            # Link any matching properties
            props = Property.objects.filter(Q(owner_phone=clean) | Q(owner_phone__endswith=clean))
            count = props.update(owner=user)
            self.stdout.write(self.style.SUCCESS(f"Linked {count} properties to user {user.username}"))
            return

        # Bulk sync all properties
        self.stdout.write("Starting bulk owner synchronization...")
        synced_count = 0
        created_users = 0

        for p in Property.objects.all():
            phone = p.owner_phone
            if not phone:
                continue
            clean = re.sub(r'\D', '', str(phone))
            if len(clean) >= 10:
                clean = clean[-10:]
            else:
                continue

            user = User.objects.filter(Q(phone=clean) | Q(phone__endswith=clean)).first()
            if not user:
                user = User.objects.create_user(
                    username=f"owner_{clean}",
                    phone=clean,
                    password=default_pwd,
                    roles=['owner'],
                    is_phone_verified=True,
                    first_name=p.owner_name or 'Property Owner'
                )
                created_users += 1
            else:
                roles = list(user.roles or [])
                if 'owner' not in roles:
                    roles.append('owner')
                    user.roles = roles
                    user.save(update_fields=['roles'])

            if p.owner != user:
                p.owner = user
                p.save(update_fields=['owner'])
                synced_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Sync complete! Created {created_users} owner users, linked/synced {synced_count} properties."
        ))
