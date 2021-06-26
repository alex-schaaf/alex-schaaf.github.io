---
title: Automatically deploy a NextJS app on a Raspberry Pi using Gitlab CI/CD
date: 2021-06-26
tags:
  - post
  - devops
layout: layouts/post.njk
---

I've built a small web app using [NextJS](http://nextjs.org) and wanted a convenient way to deploy it on my Raspberry Pi for use within my local network. I wanted to have a CI/CD pipeline which reacts to me pushing new code to the `main` branch of my project repository to create a producton build and deploys it locally. Through work I have experience with the [GitLab]() CI/CD pipeline, and I realized that they also offer their [GitLab Runner]() as a stand-alone open-source software that I can run on my RBPi and register as the CI/CD runner on any of my GitLab repositories hosted on [GitLab.com](gitlab.com).

I'm running Ubuntu Server on my RBPi, so the entire tutorial should be applicable to any device running Ubuntu.

## Making the runner work

The first step is to actually install the GitLab runner on the RBPi and register it with out GitLab repository.

Add the official GitLab repository:

```bash
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
```

And then install it using

```bash
sudo -E apt-get install gitlab-runner
```

This will automatically install the right version for your device, e.g. the `arm64` version for the

Then we need to register the GitLab repository with our runner by using the provided registration token of our repository. You can find this one in your repository `Settings > CI/CD` when expanding the `Runners` section.

```bash
sudo gitlab-runner register -n \
  --url https://gitlab.com/ \
  --registration-token $REGISTRATION_TOKEN \
  --executor shell \
  --description "<runner description>"
```

This will ask you for an executor. I went with the `shell` executor. Then make sure to add the GitLab runner to the Docker user group by running `sudo usermod -aG docker gitlab-runner`.

Then we have to add the GitLab runner to the list of sudoers by opening up the file `/etc/sudoers` and appending `gitlab-runner ALL=(ALL) NOPASSWD: ALL` at the end.

Make sure there's no `.bash_logout` file present in your home folder or at `/home/gitlab-runner/` as [this can fail your pipeline](https://docs.gitlab.com/runner/faq/README.html#job-failed-system-failure-preparing-environment).

## Setting up Docker and the CI/CD pipeline

Our deployment will be done using [Docker](). For that we need a `Dockerfile` at the root of our project. Thankfully, NextJS already provides one [here](https://nextjs.org/docs/deployment#docker-image) that I just copy-pasted into my project root. Feel free to craft your own though if you want a simpler one.

Next up we create a `.gitlab-ci.yml` file at the root of our project repository. Now we can define a first `stage` of our pipeline. Jobs withing a `stage` will be executed in parallel, while different stages will be run consecutively. Commonly, different stages are used for testing, building and deployment. But for my personal project I'm happy to just go with a combined build & deploy stage.

So we specify the `deploy` stage and add a job called `deploy-prod` to it. Within the `script` block we can specify the commands to execute during this job. We need to build our Docker container using `docker build . -t <your tag>` and then run it using `docker run -d -p 3000:3000 --rm --name <your tag> <name>`.

The result will look like this:

```yml
# .gitlab-ci.yml
image: docker
services:
  - docker:dind
stages:
  - deploy
deploy-prod:
  stage: deploy
  script:
    - docker build . -t purple-tin
    - docker run -d -p 3000:3000 --rm --name purple-tin purple-tin
```

## Running the pipeline

Running the pipeline is as simple as simply pushing new code to the repository on GitLab. Our runner will immediately notice and start running our defined pipeline. Upon success you can access your Next app on `http://<raspberrypi IP address>:3000/` within your local network!
