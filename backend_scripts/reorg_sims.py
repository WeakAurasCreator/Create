from pathlib import Path
import shutil
import argparse
import sys
import logging

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


def unique_dest(dst: Path) -> Path:
    """Return a Path that's unique on disk by appending _1, _2, ... before suffix."""
    if not dst.exists():
        return dst
    stem = dst.stem
    suffix = dst.suffix
    parent = dst.parent
    i = 1
    while True:
        candidate = parent / f"{stem}_{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def safe_move(src: Path, dst: Path, dry_run: bool = False) -> Path:
    """Move src -> dst creating parents as needed and avoiding overwrites.

    Returns the final destination path on success (or would-be destination in dry-run).
    """
    dst_parent = dst.parent
    if not dry_run:
        dst_parent.mkdir(parents=True, exist_ok=True)
    final = dst
    if dst.exists():
        final = unique_dest(dst)
    if dry_run:
        logging.info(f"DRY-RUN: Would move: {src} -> {final}")
    else:
        shutil.move(str(src), str(final))
        logging.info(f"Moved: {src} -> {final}")
    return final


def regroup_profiles(profile_dir: Path, dry_run: bool = False) -> None:
    if not profile_dir.exists():
        logging.info(f"Profiles dir not found: {profile_dir} — nothing to do")
        return
    files = sorted(profile_dir.glob("*.simc"))
    if not files:
        logging.info(f"No .simc files found in {profile_dir}")
        return
    for p in files:
        base = p.stem
        parts = base.split("_")
        cls = parts[0] if len(parts) >= 1 and parts[0] else "unknown"
        spec = parts[1] if len(parts) >= 2 and parts[1] else "unknown"
        dest = profile_dir / cls / spec / p.name
        safe_move(p, dest, dry_run=dry_run)
    logging.info("Profile regroup complete.")


def flatten_and_regroup(root: Path) -> None:
    """
    Flatten the tree under `root` and regroup .json/.html files into
    <root>_grouped/<class>/<spec>/ with filenames prefixed by their
    original relative parent path to avoid basename collisions.
    """
    if not root.exists():
        logging.info("Results dir not found: %s — nothing to do", root)
        return

    grouped = root.parent / (root.name + "_grouped")

    # ensure a fresh grouped dir
    if grouped.exists():
        logging.info("Removing existing grouped dir: %s", grouped)
        shutil.rmtree(grouped)
    grouped.mkdir(parents=True, exist_ok=True)

    exts = {".json", ".html"}
    moved = 0

    for f in sorted(root.rglob("*")):
        if not f.is_file():
            continue
        if f.suffix.lower() not in exts:
            continue

        name = f.name
        parts = name.split("_")
        cls = parts[0] if len(parts) >= 1 and parts[0] else "unknown"
        spec = parts[1] if len(parts) >= 2 and parts[1] else "unknown"
        dest_dir = grouped / cls / spec
        dest = dest_dir / name

        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(f), str(dest))
        logging.info("Moved: %s -> %s", f, dest)
        moved += 1

    logging.info("Processed %d file(s) into grouped tree at %s", moved, grouped)

    if not grouped.exists():
        logging.error("Grouped tree missing: %s", grouped)
        try:
            logging.error("Contents of parent directory (%s):", grouped.parent)
            for p in sorted(grouped.parent.iterdir()):
                logging.error("  %s", p)
        except Exception as e:
            logging.error("Could not list grouped parent directory: %s", e)
        raise FileNotFoundError(f"Grouped tree not found: {grouped}")

    try:
        if root.exists():
            logging.info("Removing original tree: %s", root)
            shutil.rmtree(root)
    except Exception as e:
        logging.warning("Could not remove original dir %s: %s", root, e)

    try:
        logging.info("Moving grouped tree %s -> %s", grouped, root)
        shutil.move(str(grouped), str(root))
        logging.info("Replaced %s with grouped tree.", root)
    except Exception as e:
        logging.error("Failed to move grouped tree into place: %s -> %s : %s", grouped, root, e)
        try:
            logging.error("Grouped parent (%s) contents on failure:", grouped.parent)
            for p in sorted(grouped.parent.iterdir()):
                logging.error("  %s", p)
        except Exception as e2:
            logging.error("  (could not list grouped parent): %s", e2)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description="Reorganize simc profiles and final sim results into class/spec directories.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_prof = sub.add_parser("profiles", help="Regroup .simc profiles into class/spec subfolders")
    p_prof.add_argument("--dir", default="data/sims/profiles", help="Profiles directory")
    p_prof.add_argument("--dry-run", action="store_true")

    p_res = sub.add_parser("results", help="Flatten & regroup final_sims into per-class/spec dirs")
    p_res.add_argument("--dir", default="data/sims/final_sims", help="Final sims root directory")
    p_res.add_argument("--dry-run", action="store_true")

    args = parser.parse_args(argv)

    if args.cmd == "profiles":
        regroup_profiles(Path(args.dir), dry_run=args.dry_run)
    elif args.cmd == "results":
        flatten_and_regroup(Path(args.dir))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
