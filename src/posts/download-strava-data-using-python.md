---
title: "Pulling your running data from Strava using Python"
date: 2021-01-23
tags: post
layout: layouts/post.njk
---

I want to make sure to have access to my running data in the future - no matter
what app, service or device I'll be using by then. So I've decided to build a
small command line tool to query the official Strava API to download running
data and save it on my server.

Thankfully, [Maksym Sladkov](https://github.com/sladkovm) created the awesome
[`stravaio`](https://github.com/sladkovm/stravaio) library, which we can use to
easily get our data out of Strava.

## Setting up the environment

```bash
mkdir strava-scrape
cd strava-scrape
touch main.py
```

I'm using [`pipenv`](https://pipenv.pypa.io/en/latest/) to create a virtual
environment for me and install `stravaio`. Alternatively you can use `pip` in
your Python environment of choice. The Python version used throughout this
article is `3.8`.

```bash
pipenv install stravaio  # alternative: pip install stravaio
```

To run Python in your virtual environmeent you can ```pipenv run python``` or
activate the environment in your current terminal using ```pipenv shell```,
which will automatically run every command within the environment (similar to
`conda` environments).

## Accessing the Strava API

To allow `stravaio` to access your Strava data using the API by generating an
API access token `STRAVA_ACCESS_TOKEN`. Thankfully, `stravaio` can do this for
you - but first we need to generate a `STRAVA_CLIENT_ID` and
`STRAVA_CLIENT_SECRET`. We can do this by logging into the Strava website,
clicking on profile picture in the upper right corner, click on *Settings* and
we can find the *My API Application* section at the bottom of the settings
navigation on the left. Weirldy enough, we first need to upload an App icon - so
simply upload a [random picture of some potatoes from
Wikipedia](https://en.wikipedia.org/wiki/Potato#/media/File:Patates.jpg). There
you can find your *Client Secret* and *Client ID*.



```python
from stravaio import strava_oauth2

strava_oauth2(client_ID=STRAVA_CLIENT_ID, client_secret=STRAVA_CLIENT_SECRET)
```

If you set both the `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` as
[environment
variables](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html),
you don't need to pass them to the `strava_oauth2` function.


## Creating the CLI using Typer

A great tool to quickly create command line interfaces in Python is
[Typer](https://typer.tiangolo.com/). It was developed by the creater of
[FastAPI](https://fastapi.tiangolo.com/). So we `pipenv install typer` and
import it into our Python script. For `typer` to work we create
a `main` function and put `typer.run(main)` into our `__name__ == '__main__'` [block](https://stackoverflow.com/questions/419163/what-does-if-name-main-do). 

```python
import typer
from stravaio import StravaIO, strava_oauth2


def main():
    access_token = strava_oauth2()  # get access token
    api_client = StravaIO(access_token=access_token)  # API client


if __name__ == "__main__":
    typer.run(main)
```
If we now run our script, it will open a Strava API authentification page in our
browser to allow `stravaio` to access our Strava data.

So we are ready to roll and can start making API requests to Strava. Let's first
get all activities of the logged-in athlete (us).

```python/3/
def main():
    access_token = strava_oauth2().get("access_token")  # get access token
    api_client = StravaIO(access_token=access_token)  # API client
    remote_activities: list = api_client.get_logged_in_athlete_activities()
```

This will get us a list of `SummaryActivity` objects which contain summary data
for each respective activity. But this includes all recorded activities. I'm
only interested in my running data, and not in other activities I might have
recorded (e.g. bike rides, hikes). So let's filter the list of activities for
runs and collect their ID's in a list of activities we actually want to
download.

```python/5-7/
def main():
    access_token = strava_oauth2().get("access_token")  # get access token
    api_client = StravaIO(access_token=access_token)  # API client
    remote_activities: list = api_client.get_logged_in_athlete_activities()

    activities_to_sync = [
        activity for activity in remote_activities if activity.type == "Run"
    ]
```

But before we query the Strava API we should add a CLI argument to specify the
filepath for the folder we want to save the data into. This is exceptionally
simple in `typer`, as we simple add an argument to the `main` function. We then
turn the `filepath: str` into a `Path` object for convenience and use `os` to 
make sure the filepath actually exist - and create it if not.

```python/0-1,5-8/
from pathlib import Path
import os


def main(filepath: str):
    filepath = Path(filepath)
    if not os.path.isdir(filepath):
        typer.echo(f"'{filepath}' not found. Creating directory.")
        os.mkdir(filepath)

    access_token = strava_oauth2().get("access_token")  # get access token
    api_client = StravaIO(access_token=access_token)  # API client
    remote_activities: list = api_client.get_logged_in_athlete_activities()

    activities_to_sync = [
        activity for activity in remote_activities if activity.type == "Run"
    ]
```

Then we can start coding up the loop to actually get the activity data from the
API: We loop over all activity sumaries of our runs and use their id to
`get_activity_by_id`. We transform the returning object into a `dict` and use
the `json` module to dump it to file.

```python/15-18/
# ...
def main(filepath: str):
    filepath = Path(filepath)
    if not os.path.isdir(filepath):
        typer.echo(f"'{filepath}' not found. Creating directory.")
        os.mkdir(filepath)

    access_token = strava_oauth2().get("access_token")
    api_client = StravaIO(access_token=access_token)
    remote_activities = api_client.get_logged_in_athlete_activities()

    activities_to_sync = [
        activity for activity in remote_activities if activity.type == "Run"
    ]
    
    for activity_summary in activities_to_sync:
        activity = api_client.get_activity_by_id(activity_summary.id).to_dict()
        with open(filepath / (activity.id + ".json"), "w") as file:
            json.dump(activity, file, indent=2)
```

With that we're kinda done - except that now we have a folder full of files
named after unintelligable ID's. We could set up a database (e.g. sqlite) to
store the running data and make it query-able. But for my purposes, it feels
like more of a hassle. So let's just save the activities named after their
starting timestamp - that way we can easily access our activities my time. This
also enables us to easily check the date of our most recent local activity
and only query Strava for newer activities.

## Refining the prototype

...

