#!/usr/bin/env python3
"""
Script to update HTML files with Dropbox public sharing URLs
This replaces relative paths with Dropbox URLs for GitHub Pages deployment
"""

import os
import re
import sys
from pathlib import Path

def update_html_with_dropbox_urls(html_file_path, dropbox_urls):
    """
    Update HTML file to use Dropbox URLs instead of relative paths
    
    Args:
        html_file_path (str): Path to HTML file to update
        dropbox_urls (dict): Mapping of file names to Dropbox URLs
    """
    
    # Read the original file
    with open(html_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Create backup
    backup_path = f"{html_file_path}.backup"
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Created backup: {backup_path}")
    
    # Update file paths
    replacements = {
        'data/nz_places.geojson': dropbox_urls.get('nz_places.geojson', 'DROPBOX_URL_NEEDED'),
        'data/sa2.geojson': dropbox_urls.get('sa2.geojson', 'DROPBOX_URL_NEEDED'),
        'src/religion.json': dropbox_urls.get('religion.json', 'DROPBOX_URL_NEEDED'),
        'src/demographics.json': dropbox_urls.get('demographics.json', 'DROPBOX_URL_NEEDED'),
    }
    
    # Apply replacements
    updated_content = content
    for old_path, new_url in replacements.items():
        # Match both quoted and unquoted versions
        patterns = [
            f'"{old_path}"',
            f"'{old_path}'",
            f'`{old_path}`',
            old_path  # unquoted version
        ]
        
        for pattern in patterns:
            if pattern in updated_content:
                replacement = f'"{new_url}"' if not pattern.startswith('"') and not pattern.startswith("'") else pattern.replace(old_path, new_url)
                updated_content = updated_content.replace(pattern, replacement)
                print(f"Replaced: {pattern} → {replacement}")
    
    # Write updated file
    with open(html_file_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"Updated: {html_file_path}")

def main():
    """
    Main function to update HTML files with Dropbox URLs
    """
    
    # Actual Dropbox public sharing URLs (converted to direct download)
    dropbox_urls = {
        'nz_places.geojson': 'https://www.dropbox.com/scl/fi/jss3eqlbkitemjb1bomjx/nz_places.geojson?rlkey=2iquuitdfcwq0u7lo3lounlnb&dl=1',
        'sa2.geojson': 'https://www.dropbox.com/scl/fi/4vvvn4dmzoo4f2ky35gl5/sa2.geojson?rlkey=ch8jqvczpqivtkzgow5ujtqvq&dl=1',
        'religion.json': 'https://www.dropbox.com/scl/fi/k3ykwk1x26wzeibu34056/religion.json?rlkey=jje4fwnbq9wmufr3i9icjc3bu&dl=1',
        'demographics.json': 'https://www.dropbox.com/scl/fi/vjoqkmv08g0wit8kl6d29/demographics.json?rlkey=6h4lnbh4k9yjqdhx3wmag773m&dl=1'
    }
    
    # Get repository root
    repo_root = Path(__file__).parent.parent
    
    # Files to update in gh-pages branch
    html_files = [
        repo_root / "index.html",
        repo_root / "enhanced-places.html", 
        repo_root / "places.html"
    ]
    
    print("=== Updating HTML files with Dropbox URLs ===")
    print()
    print("IMPORTANT: You need to replace the placeholder URLs with actual Dropbox public sharing links:")
    print()
    for filename, placeholder in dropbox_urls.items():
        print(f"  {filename}: {placeholder}")
    print()
    
    # Check if we're on gh-pages branch
    try:
        import subprocess
        result = subprocess.run(['git', 'branch', '--show-current'], 
                              capture_output=True, text=True, cwd=repo_root)
        current_branch = result.stdout.strip()
        
        if current_branch != 'gh-pages':
            print(f"Warning: Currently on branch '{current_branch}', not 'gh-pages'")
            print("Run: git checkout gh-pages")
            print()
    except:
        pass
    
    # Update each HTML file
    for html_file in html_files:
        if html_file.exists():
            print(f"Processing: {html_file}")
            update_html_with_dropbox_urls(str(html_file), dropbox_urls)
            print()
        else:
            print(f"Skipping (not found): {html_file}")
    
    print("=== Next Steps ===")
    print("1. Get Dropbox public sharing URLs for each data file:")
    print("   - Right-click files in Dropbox → Share → Create link → Copy link")
    print("   - Convert share links to direct download links (replace ?dl=0 with ?dl=1)")
    print()
    print("2. Edit this script to replace PLACEHOLDER_DROPBOX_URL_* with actual URLs")
    print("3. Run this script again to apply the real URLs")
    print("4. Commit and push to gh-pages branch:")
    print("   git add . && git commit -m 'Update with Dropbox URLs' && git push origin gh-pages")

if __name__ == "__main__":
    main()