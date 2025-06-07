#!/usr/bin/env python3
"""
Discord Cryptochat Extension Icon Generator
Creates professional icons for the browser extension using PIL/Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

def create_gradient_background(size, color1, color2):
    """Create a gradient background from color1 to color2"""
    image = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    for y in range(size[1]):
        # Calculate gradient position (0.0 to 1.0)
        ratio = y / size[1]
        
        # Interpolate between colors
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        a = int(color1[3] * (1 - ratio) + color2[3] * ratio)
        
        draw.line([(0, y), (size[0], y)], fill=(r, g, b, a))
    
    return image

def draw_lock_icon(draw, center_x, center_y, size, color):
    """Draw a lock icon at the specified position"""
    # Scale lock parts based on icon size
    lock_body_width = int(size * 0.6)
    lock_body_height = int(size * 0.4)
    shackle_width = int(size * 0.4)
    shackle_height = int(size * 0.3)
    
    # Lock body (rectangle with rounded corners)
    body_left = center_x - lock_body_width // 2
    body_top = center_y - lock_body_height // 4
    body_right = center_x + lock_body_width // 2
    body_bottom = center_y + lock_body_height * 3 // 4
    
    # Draw lock body with rounded corners
    corner_radius = min(lock_body_width, lock_body_height) // 8
    draw.rounded_rectangle(
        [body_left, body_top, body_right, body_bottom],
        radius=corner_radius,
        fill=color
    )
    
    # Lock shackle (U-shaped)
    shackle_left = center_x - shackle_width // 2
    shackle_right = center_x + shackle_width // 2
    shackle_top = center_y - lock_body_height // 2 - shackle_height
    shackle_bottom = center_y - lock_body_height // 4 + 2
    
    # Draw shackle outline
    thickness = max(2, size // 20)
    
    # Left side of shackle
    draw.line(
        [shackle_left, shackle_bottom, shackle_left, shackle_top],
        fill=color, width=thickness
    )
    
    # Top of shackle
    draw.line(
        [shackle_left, shackle_top, shackle_right, shackle_top],
        fill=color, width=thickness
    )
    
    # Right side of shackle
    draw.line(
        [shackle_right, shackle_top, shackle_right, shackle_bottom],
        fill=color, width=thickness
    )
    
    # Lock keyhole
    keyhole_radius = max(2, size // 16)
    keyhole_x = center_x
    keyhole_y = center_y + lock_body_height // 8
    
    # Keyhole circle
    draw.ellipse(
        [keyhole_x - keyhole_radius, keyhole_y - keyhole_radius,
         keyhole_x + keyhole_radius, keyhole_y + keyhole_radius],
        fill=(255, 255, 255, 200)
    )
    
    # Keyhole slot
    slot_width = keyhole_radius // 2
    slot_height = keyhole_radius
    draw.rectangle(
        [keyhole_x - slot_width, keyhole_y,
         keyhole_x + slot_width, keyhole_y + slot_height],
        fill=(255, 255, 255, 200)
    )

def create_icon(size):
    """Create a single icon of the specified size"""
    # Create image with transparent background
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Create gradient background
    gradient_color1 = (102, 126, 234, 255)  # #667eea
    gradient_color2 = (118, 75, 162, 255)   # #764ba2
    
    # Create circular gradient background
    draw = ImageDraw.Draw(image)
    
    # Draw circular background with gradient effect
    center = size // 2
    radius = int(size * 0.45)
    
    # Create multiple circles for gradient effect
    steps = 20
    for i in range(steps):
        ratio = i / steps
        current_radius = int(radius * (1 - ratio * 0.3))
        
        # Interpolate colors
        r = int(gradient_color1[0] * (1 - ratio) + gradient_color2[0] * ratio)
        g = int(gradient_color1[1] * (1 - ratio) + gradient_color2[1] * ratio)
        b = int(gradient_color1[2] * (1 - ratio) + gradient_color2[2] * ratio)
        alpha = int(255 * (1 - ratio * 0.2))
        
        # Draw circle
        draw.ellipse(
            [center - current_radius, center - current_radius,
             center + current_radius, center + current_radius],
            fill=(r, g, b, alpha)
        )
    
    # Add subtle shadow/depth
    shadow_offset = max(1, size // 32)
    shadow_radius = radius - shadow_offset
    draw.ellipse(
        [center - shadow_radius + shadow_offset, center - shadow_radius + shadow_offset,
         center + shadow_radius + shadow_offset, center + shadow_radius + shadow_offset],
        fill=(0, 0, 0, 30)
    )
    
    # Draw the lock icon
    lock_size = int(size * 0.5)
    lock_color = (255, 255, 255, 255)
    draw_lock_icon(draw, center, center, lock_size, lock_color)
    
    # Add a subtle highlight
    highlight_radius = int(radius * 0.8)
    highlight_thickness = max(1, size // 48)
    draw.ellipse(
        [center - highlight_radius, center - highlight_radius,
         center + highlight_radius, center + highlight_radius],
        outline=(255, 255, 255, 80), width=highlight_thickness
    )
    
    return image

def main():
    """Generate all icon sizes"""
    print("🎨 Generating Discord Cryptochat Extension Icons...")
    
    # Create icons directory if it doesn't exist
    icons_dir = "icons"
    if not os.path.exists(icons_dir):
        os.makedirs(icons_dir)
    
    # Icon sizes to generate
    sizes = [16, 48, 128]
    
    for size in sizes:
        print(f"   Creating {size}x{size} icon...")
        
        # Generate icon
        icon = create_icon(size)
        
        # Save icon
        filename = f"{icons_dir}/icon{size}.png"
        icon.save(filename, "PNG")
        
        print(f"   ✅ Saved: {filename}")
    
    print("\n🎉 All icons generated successfully!")
    print("\nGenerated files:")
    for size in sizes:
        filename = f"{icons_dir}/icon{size}.png"
        print(f"  📁 {filename}")
    
    print("\n💡 Your extension now has professional icons!")
    print("   The icons feature a gradient background with a lock symbol,")
    print("   perfect for representing encryption and security.")

if __name__ == "__main__":
    main() 