#!/usr/bin/env python3

import os
import glob
import argparse
import numpy as np
import rioxarray
import xarray as xr
import geopandas as gpd


def main():
    """Main execution function using rioxarray for raster processing."""
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description='Merge and clip GHSL raster files for a specific year.'
    )
    parser.add_argument(
        '--year',
        type=int,
        default=2025,
        help='Year for GHSL data to process (default: 2025)'
    )
    parser.add_argument(
        '--data-folder',
        type=str,
        default='../data',
        help='Path to data folder (default: ../data)'
    )
    parser.add_argument(
        '--no-reproject',
        action='store_true',
        help='Skip reprojection to EPSG:4326 (default: reproject is enabled)'
    )
    args = parser.parse_args()

    # Configuration
    data_folder = args.data_folder
    year = args.year
    reproject = not args.no_reproject  # Reproject by default unless --no-reproject is specified
    raster_pattern = os.path.join(data_folder, "ghsl", f"*{year}*.tif")
    geojson_file = os.path.join(data_folder, "admin", "adm1.geojson")
    output_file = os.path.join(data_folder, "ghsl", f"ghsl_{year}.tif")

    try:
        # Find rasters for the specified year
        raster_files = glob.glob(raster_pattern)
        if not raster_files:
            raise FileNotFoundError(f"No raster files found matching pattern: {raster_pattern}")

        print(f"Found {len(raster_files)} raster files:")
        for f in raster_files:
            print(f"  {f}")

        # Load clipping boundary
        print(f"\nLoading clipping boundary from: {geojson_file}")
        boundary_gdf = gpd.read_file(geojson_file)

        # Load and merge rasters
        print("Loading and merging rasters...")
        rasters = []
        for fp in raster_files:
            da = rioxarray.open_rasterio(fp, masked=True)
            # Replace original nodata (-200) with np.nan and convert to float32
            da = da.where(da != -200, other=np.nan)
            da = da.astype('float32')
            da = da.rio.write_nodata(np.nan)
            rasters.append(da)

        # Merge rasters using xarray
        merged = xr.concat(rasters, dim='band').max(dim='band', skipna=True)
        merged = merged.rio.write_nodata(np.nan)

        # Get the CRS from the first raster
        raster_crs = rasters[0].rio.crs

        # Reproject boundary to match raster CRS if needed
        if boundary_gdf.crs != raster_crs:
            boundary_gdf = boundary_gdf.to_crs(raster_crs).buffer(5000)

        # Clip raster with boundary
        print("Clipping merged raster with boundary...")
        clipped = merged.rio.clip(boundary_gdf.geometry.values, boundary_gdf.crs, all_touched=True)

        # Reproject by default (unless --no-reproject flag is used)
        if reproject:
            print("Reprojecting to EPSG:4326...")
            clipped = clipped.rio.reproject("EPSG:4326")

        # Save output
        print(f"Saving raster to: {output_file}")
        clipped.rio.to_raster(
            output_file,
            dtype='float32',
            compress='deflate',
            predictor=2
        )

        print(f"Output saved to: {output_file}")

    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Make sure your raster files and GeoJSON boundary file exist.")
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
