---
head:
  - - meta
    - name: description
      content: A Brief word about Test Config

title: Introduction
---

# A Brief word about Test Config

One of the biggest annoyances with frameworks of any kind is when config is scattered around multiple locations.

This puts the onus on any user to learn, and even worse - dig around; with how the current config is structured to get an idea of the conditions where a test has been executed.

This happens incredibly frequently, as usually when a test case breaks - it may be because of an environment level switch that is in our control to change. This may be anything from a system balance, to a block time to even which script has been run.

The goal behind Moonwall's configuration design is to have a single source of truth when it comes to the network where a test has been run.
