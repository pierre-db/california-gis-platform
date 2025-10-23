"""
Download CLMS Water Bodies data from Copernicus catalog
Uses S3 access via boto3
"""

import os
from os.path import join
import pandas as pd
from tqdm import tqdm
import boto3
from botocore import UNSIGNED
from botocore.config import Config


def load_catalog(catalog_url):
    """Load the Water Bodies COG catalog from CSV."""
    print("Loading catalog...")
    catalog_df = pd.read_csv(catalog_url)
    print(f"✓ Loaded {len(catalog_df)} products")
    return catalog_df


def filter_by_date(catalog_df, start_date, end_date):
    """Filter catalog by date range."""
    catalog_df['nominal_date'] = pd.to_datetime(catalog_df['nominal_date'])
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)

    filtered = catalog_df[
        (catalog_df['nominal_date'] >= start) &
        (catalog_df['nominal_date'] <= end)
    ]

    print(f"✓ Found {len(filtered)} products between {start_date} and {end_date}")
    return filtered


def setup_s3_client(access_key=None, secret_key=None):
    """
    Setup S3 client for EODATA bucket.

    If access_key and secret_key are None, attempts anonymous access.
    Get credentials from: https://dataspace.copernicus.eu/ -> S3 Keys Manager
    """
    endpoint_url = 'https://eodata.dataspace.copernicus.eu'

    if access_key and secret_key:
        print("✓ Using authenticated S3 access")
        s3_client = boto3.client(
            's3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint_url
        )
    else:
        print("⚠ Attempting anonymous S3 access (may fail if bucket requires auth)")
        s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            config=Config(signature_version=UNSIGNED)
        )

    return s3_client


def download_from_s3(s3_client, s3_path, output_path):
    """Download a file from S3 with progress bar."""
    try:
        # Parse S3 path
        # Format: s3://EODATA/path/to/file
        parts = s3_path.replace('s3://', '').split('/', 1)
        bucket = parts[0]  # Keep original case - bucket name is "EODATA" (uppercase)
        key = parts[1] if len(parts) > 1 else ''

        print(f"  Bucket: {bucket}, Key: {key[:100]}...")

        # Get file size
        response = s3_client.head_object(Bucket=bucket, Key=key)
        file_size = response['ContentLength']

        # Download with progress bar
        with tqdm(total=file_size, unit='B', unit_scale=True,
                 desc=os.path.basename(output_path)) as pbar:
            s3_client.download_file(
                bucket, key, output_path,
                Callback=lambda bytes_transferred: pbar.update(bytes_transferred)
            )

        return True
    except Exception as e:
        print(f"✗ Download failed: {e}")
        print(f"  Error type: {type(e).__name__}")
        return False


def main():
    # Configuration
    DATA_FOLDER = '../data'
    OUTPUT_FOLDER = join(DATA_FOLDER, 'water_bodies')
    CATALOG_URL = "https://s3.waw3-1.cloudferro.com/swift/v1/CatalogueCSV/bio-geophysical/water_bodies/wb_global_300m_monthly_v2/wb_global_300m_monthly_v2_cog.csv"

    # Date range
    START_DATE = '2023-01-01'
    END_DATE = '2023-12-31'

    # S3 Credentials (get from https://dataspace.copernicus.eu/ -> S3 Keys Manager)
    # Set as environment variables or replace with your keys
    S3_ACCESS_KEY = os.environ.get('COPERNICUS_S3_ACCESS_KEY')
    S3_SECRET_KEY = os.environ.get('COPERNICUS_S3_SECRET_KEY')

    # Create output folder
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    print(f"Output folder: {OUTPUT_FOLDER}\n")

    # Setup S3 client
    s3_client = setup_s3_client(S3_ACCESS_KEY, S3_SECRET_KEY)

    # Load and filter catalog
    catalog_df = load_catalog(CATALOG_URL)
    filtered_catalog = filter_by_date(catalog_df, START_DATE, END_DATE)

    if filtered_catalog.empty:
        print("No products found matching criteria")
        return

    # Show what we'll download
    print(f"\nProducts to download:")
    print(filtered_catalog[['nominal_date', 'name']].to_string(index=False))
    print(f"\n{'='*60}")

    # Download files
    downloaded = 0
    skipped = 0
    failed = 0

    for idx, row in filtered_catalog.iterrows():
        s3_path = row['s3_path']
        filename = row['name']
        output_path = join(OUTPUT_FOLDER, filename)

        # Skip if already exists
        if os.path.exists(output_path):
            print(f"⊘ Skipping {filename} (already exists)")
            skipped += 1
            continue

        print(f"\nDownloading: {filename}")
        print(f"  From: {s3_path}")
        success = download_from_s3(s3_client, s3_path, output_path)

        if success:
            downloaded += 1
            print(f"✓ Saved to {output_path}")
        else:
            failed += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"  Downloaded: {downloaded}")
    print(f"  Skipped: {skipped}")
    print(f"  Failed: {failed}")
    print(f"  Total: {len(filtered_catalog)}")
    print(f"{'='*60}")

    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        print(f"\n⚠ NOTE: No S3 credentials provided.")
        print(f"   If downloads failed, register at https://dataspace.copernicus.eu/")
        print(f"   and generate S3 keys, then set environment variables:")
        print(f"   export COPERNICUS_S3_ACCESS_KEY='your_key'")
        print(f"   export COPERNICUS_S3_SECRET_KEY='your_secret'")


if __name__ == '__main__':
    main()
