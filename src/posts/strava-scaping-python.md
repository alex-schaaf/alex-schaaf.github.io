---
title: Download your Strava running data using Python
date: 2020-02-28
tags: 
  - post
  - coding
  - python
  - running
layout: layouts/post.njk
---

```python
from pathlib import Path
import os
import json
from datetime import datetime
from tqdm import tqdm

import typer
from stravaio import StravaIO, strava_oauth2
import pandas as pd


def timestampify(d: datetime) -> int:
    """Turn datetime object into unix timestamp int."""
    return int((d - datetime(1970, 1, 1, tzinfo=d.tzinfo)).total_seconds())


def check_paths(filepath) -> None:
    filepath_streams = Path(filepath / "streams")
    if not os.path.isdir(filepath):
        typer.echo(f"'{filepath}' not found. Creating directory.")
        os.mkdir(filepath)
        if not os.path.isdir(filepath_streams):
            os.mkdir(filepath_streams)


def main(
    destination: str,
    all: bool = False,
    verbose: bool = False,
    parquet: bool = False,
    client_id: int = None,
    client_secret: str = None,
):
    """Download Strava activities to destination folder.

    Activities are saved as JSON files with activity unix timestamp as filename. Streams
    are saved as JSON files (streams/{timestamp}_stream.json), optionally as PARQUET.

    If no client id and client secret are passed it will look for set environment
    variables.

    Parameters
    ----------
    destination : str
        Destination path. Get's created if it doesn't exist.
    all : bool, optional
        Toogles downloading all activities without regard to which already exist at
        the destination folder, by default False
    verbose : bool, optional
        Toggles verbosity, by default False
    parquet : bool, optional
        Toggles saving activity streams as parquet files instead of json, by default False
    client_id : int, optional
        Strava API Client ID.
    client_secret : str, optional
        Strava API Client Secret.
    """
    filepath = Path(destination)
    filepath_streams = Path(filepath / "streams")
    check_paths(filepath)

    # determine the most recent activity
    local_activities = [
        int(fn[:-5]) for fn in os.listdir(filepath) if fn.endswith(".json")
    ]
    local_streams = [int(fn.split("_")[0]) for fn in os.listdir(filepath_streams)]
    if local_activities and not all:
        youngest_activity = max(local_activities)
    else:
        youngest_activity = 0

    access_token = strava_oauth2(client_id=client_id, client_secret=client_secret).get(
        "access_token"
    )
    api_client = StravaIO(access_token=access_token)
    athlete = api_client.get_logged_in_athlete()

    remote_activities = api_client.get_logged_in_athlete_activities(
        after=youngest_activity
    )

    # filter remote activities for runs only
    activities_to_sync = [act for act in remote_activities if act.type == "Run"]

    for activity_summary in tqdm(activities_to_sync):
        # convert timestamp into unix timestamp to be used as filesname
        timestamp = timestampify(activity_summary.start_date)

        # check if timestamp exists in both activities and streams: skip
        # to avoid redundant api queriesp
        if timestamp in local_activities and timestamp in local_streams:
            continue

        activity = api_client.get_activity_by_id(activity_summary.id).to_dict()

        # save activity data to json
        with open(filepath / f"{timestamp}.json", "w") as file:
            json.dump(activity, file, indent=2)

        # if it's not a manually added activity we want to download
        # the stream data (i.e. all the gps data from runs) and save it
        # to either json or parquet
        if not activity_summary.manual:
            stream = api_client.get_activity_streams(
                activity_summary.id, athlete.id
            ).to_dict()

            if parquet:
                pd.DataFrame(stream).to_parquet(
                    filepath / "streams" / f"{timestamp}_stream.parquet"
                )
            else:
                with open(
                    filepath / "streams" / f"{timestamp}_stream.json", "w"
                ) as file:
                    json.dump(stream, file, indent=2)


if __name__ == "__main__":
    typer.run(main)
```