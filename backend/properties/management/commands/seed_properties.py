import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from accounts.models import User
from properties.models import Property, City, Locality

class Command(BaseCommand):
    help = 'Seeds the database with cities, localities, and 15 realistic dummy properties for local testing.'

    def handle(self, *args, **kwargs):
        if Property.objects.exists():
            self.stdout.write(self.style.WARNING('Database already has properties. Skipping seed to prevent duplicates.'))
            return

        # Seed Cities
        hubli, _ = City.objects.get_or_create(
            name="Hubli",
            state="Karnataka",
            defaults={'is_active': True, 'unlock_price': Decimal('14.00')}
        )
        dharwad, _ = City.objects.get_or_create(
            name="Dharwad",
            state="Karnataka",
            defaults={'is_active': True, 'unlock_price': Decimal('14.00')}
        )

        # Seed Localities
        hubli_localities = ["Vidyanagar", "Gokul Road", "Keshwapur", "Navanagar", "Unkal", "Sirur Park"]
        dharwad_localities = ["Saptapur", "Gokul", "Jubilee Circle"]
        localities = []
        for ln in hubli_localities:
            loc, _ = Locality.objects.get_or_create(city=hubli, name=ln)
            localities.append(loc)
        for ln in dharwad_localities:
            loc, _ = Locality.objects.get_or_create(city=dharwad, name=ln)
            localities.append(loc)

        # Create dummy agent
        agent, created = User.objects.get_or_create(
            username='test_agent',
            defaults={
                'role': 'agent',
                'email': 'agent@rentlo.local',
                'phone': '1234567890'
            }
        )
        if created:
            agent.set_password('password123')
            agent.save()
            self.stdout.write(self.style.SUCCESS('Created dummy agent: test_agent / password123'))
            
        agent.assigned_cities.add(city)

        property_types = ['house', 'apartment', 'plot', 'commercial']
        statuses = ['draft', 'pending_review', 'live', 'sold', 'rented', 'expired', 'rejected']
        base_lat = Decimal('15.3647')
        base_lng = Decimal('75.1240')

        properties_to_create = []
        for i in range(15):
            prop = Property(
                agent=agent,
                owner_name=f'Owner {i+1}',
                owner_phone=f'555-010{i:02d}',
                locality=random.choice(localities),
                exact_lat=base_lat + Decimal(random.uniform(-0.1, 0.1)),
                exact_lng=base_lng + Decimal(random.uniform(-0.1, 0.1)),
                price=Decimal(random.randint(100000, 2000000)),
                property_type=random.choice(property_types),
                description=f'This is a beautiful and spacious {random.choice(property_types)} located in a prime area. Perfect for your needs! Property #{i+1}',
                status=random.choice(statuses),
                consent_proof_url=f'https://example.com/consent_{i+1}.pdf'
            )
            properties_to_create.append(prop)

        Property.objects.bulk_create(properties_to_create)
        self.stdout.write(self.style.SUCCESS(f'Successfully seeded City, Localities, and 15 dummy properties.'))
