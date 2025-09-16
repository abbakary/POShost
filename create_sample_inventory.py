import os
import random
import django
from django.utils import timezone
from faker import Faker

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_tracker.settings')
django.setup()

from tracker.models import Brand, InventoryItem, User
from django.contrib.auth import get_user_model

fake = Faker()

# Create a superuser if not exists
def ensure_superuser():
    User = get_user_model()
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    return User.objects.get(username='admin')

def create_sample_brands():
    print("Creating sample brands...")
    
    # Common tire brands
    tire_brands = [
        'Michelin', 'Bridgestone', 'Goodyear', 'Continental', 'Pirelli',
        'Dunlop', 'Hankook', 'Yokohama', 'Toyo', 'Firestone'
    ]
    
    # Common auto parts brands
    auto_parts_brands = [
        'Bosch', 'Denso', 'Mobil 1', 'Castrol', 'Valvoline',
        'NGK', 'Brembo', 'Mann Filter', 'Mann+Hummel', 'Mahle'
    ]
    
    all_brands = tire_brands + auto_parts_brands
    
    created_brands = []
    for brand_name in all_brands:
        brand, created = Brand.objects.get_or_create(
            name=brand_name,
            defaults={
                'description': f"{brand_name} is a leading manufacturer of automotive products.",
                'country_of_origin': fake.country(),
                'website': f"https://www.{brand_name.lower()}.com",
                'contact_email': f"info@{brand_name.lower()}.com"
            }
        )
        if created:
            created_brands.append(brand)
    
    print(f"Created {len(created_brands)} brands")
    return created_brands

def create_sample_inventory_items(brands, user):
    print("\nCreating sample inventory items...")
    
    # Tire categories and models
    tire_categories = [
        'All-Season', 'Summer', 'Winter', 'All-Terrain', 'Mud-Terrain',
        'Performance', 'Touring', 'Highway', 'Passenger', 'Light Truck'
    ]
    
    tire_models = [
        'EcoPlus', 'TurboGrip', 'AllSeason Pro', 'WinterMaster', 'MudKing',
        'StreetSport', 'Touring Plus', 'Highway Cruiser', 'EcoTrek', 'Performance GT'
    ]
    
    # Auto parts categories and items
    parts_categories = [
        'Engine Oil', 'Oil Filter', 'Air Filter', 'Brake Pads', 'Brake Rotors',
        'Spark Plugs', 'Battery', 'Windshield Wipers', 'Cabin Air Filter', 'Headlight Bulbs'
    ]
    
    parts_models = [
        'Pro', 'Premium', 'Eco', 'Performance', 'OEM',
        'Ultra', 'Standard', 'Heavy Duty', 'EcoFriendly', 'Racing'
    ]
    
    # Create tire items
    tire_brands = brands[:10]  # First 10 brands are tire brands
    tire_items = []
    for brand in tire_brands:
        for i in range(2):  # 2 items per brand
            category = random.choice(tire_categories)
            model = random.choice(tire_models)
            size = f"{random.choice([15, 16, 17, 18, 19, 20])}/" \
                  f"{random.choice([65, 70, 75])}R{random.choice([15, 16, 17, 18])}"
            
            item = InventoryItem(
                name=f"{brand.name} {model} {category} Tire",
                brand=brand,
                description=f"{size} {category} tire by {brand.name}. {fake.sentence()}",
                quantity=random.randint(0, 50),
                price=random.randint(80, 300) + random.choice([0, 0.99]),
                cost_price=random.randint(50, 200) + random.choice([0, 0.99]),
                sku=f"TIR-{brand.name[:3].upper()}{random.randint(1000, 9999)}",
                barcode=f"{random.randint(100000000000, 999999999999)}",
                reorder_level=random.choice([2, 5, 10]),
                location=f"Aisle {random.randint(1, 10)}, Bay {random.choice('ABCDE')}",
                is_active=random.choice([True, True, True, False])  # 25% chance of being inactive
            )
            tire_items.append(item)
    
    # Create auto parts items
    parts_brands = brands[10:]  # Remaining brands are auto parts brands
    parts_items = []
    for brand in parts_brands:
        for i in range(3):  # 3 items per brand
            category = random.choice(parts_categories)
            model = random.choice(parts_models)
            
            # Set price ranges based on category
            if 'Oil' in category:
                price = random.uniform(5.99, 49.99)
                cost = price * 0.6
            elif 'Filter' in category:
                price = random.uniform(8.99, 34.99)
                cost = price * 0.55
            elif 'Brake' in category:
                price = random.uniform(25.99, 199.99)
                cost = price * 0.5
            else:
                price = random.uniform(4.99, 149.99)
                cost = price * 0.6
            
            item = InventoryItem(
                name=f"{brand.name} {model} {category}",
                brand=brand,
                description=f"{category} by {brand.name}. {fake.sentence()}",
                quantity=random.randint(0, 100),
                price=round(price, 2),
                cost_price=round(cost, 2),
                sku=f"PRT-{brand.name[:3].upper()}{random.randint(1000, 9999)}",
                barcode=f"{random.randint(100000000000, 999999999999) if i % 3 == 0 else ''}",  # Some items may not have barcodes
                reorder_level=random.choice([5, 10, 15]),
                location=f"Aisle {random.randint(11, 20)}, Bin {random.choice('FGHIJ')}",
                is_active=random.choice([True, True, True, False])  # 25% chance of being inactive
            )
            parts_items.append(item)
    
    # Bulk create all items
    all_items = tire_items + parts_items
    created_items = InventoryItem.objects.bulk_create(all_items)
    
    print(f"Created {len(created_items)} inventory items")
    return created_items

def create_inventory_adjustments(items, user):
    print("\nCreating inventory adjustments...")
    
    adjustments = []
    for item in items:
        # Create initial stock addition
        adjustments.append(
            InventoryAdjustment(
                item=item,
                adjustment_type='addition',
                quantity=item.quantity + random.randint(5, 20),  # Initial stock was higher
                previous_quantity=0,
                new_quantity=item.quantity + random.randint(5, 20),
                notes='Initial stock',
                adjusted_by=user,
                reference=f'INIT-{item.sku}'
            )
        )
        
        # Random adjustments (additions/removals)
        for _ in range(random.randint(0, 3)):  # 0-3 adjustments per item
            adjustment_type = random.choice(['addition', 'removal', 'correction'])
            if adjustment_type == 'addition':
                qty = random.randint(1, 10)
                prev_qty = item.quantity
                new_qty = prev_qty + qty
                note = f'Received {qty} units from supplier'
            elif adjustment_type == 'removal':
                qty = random.randint(1, min(5, item.quantity))
                prev_qty = item.quantity
                new_qty = prev_qty - qty
                note = f'Removed {qty} units for customer order'
            else:  # correction
                qty = random.randint(-5, 5)
                prev_qty = item.quantity
                new_qty = prev_qty + qty
                note = f'Quantity correction: {qty:+d} units (inventory count)'
            
            adjustments.append(
                InventoryAdjustment(
                    item=item,
                    adjustment_type=adjustment_type,
                    quantity=qty,
                    previous_quantity=prev_qty,
                    new_quantity=new_qty,
                    notes=note,
                    adjusted_by=user,
                    reference=f'ADJ-{item.sku}-{random.randint(1000, 9999)}'
                )
            )
    
    # Bulk create adjustments
    created_adjustments = InventoryAdjustment.objects.bulk_create(adjustments)
    print(f"Created {len(created_adjustments)} inventory adjustments")
    return created_adjustments

def main():
    print("=== Starting Sample Inventory Creation ===")
    
    # Ensure we have a user for adjustments
    user = ensure_superuser()
    
    # Create sample data
    brands = create_sample_brands()
    items = create_sample_inventory_items(brands, user)
    adjustments = create_inventory_adjustments(items, user)
    
    print("\n=== Sample Data Creation Complete ===")
    print(f"Total Brands: {len(brands)}")
    print(f"Total Items: {len(items)}")
    print(f"Total Adjustments: {len(adjustments)}")
    print("\nYou can now log in to the admin panel to view the sample data.")
    print("Username: admin")
    print("Password: admin")

if __name__ == "__main__":
    main()
