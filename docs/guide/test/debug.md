# Debugging Tests

## Tailing the Logs

For debugging purposes you may find it helpful to tail the logs while running your tests. To do this, take the following steps: 

1. Choose **2. Network Launcher & Toolbox**
2. Choose your environment.
3. Press any key, then choose **Tail**

![Tail Logs](/tail.png)

While tailing the logs, you can manage your tests with the following key commands: 

- [**q**] Quit 
- [**t**] Run all tests 
- [**g**] Grep test (to run a specific test)
- [**p**] Pause tail 

### Analyzing the Logs

The default location of your log files is `/tmp/node_logs`. The full location can be found at the top of the console output when tailing the logs in the prior step. 

::: tip
The logs automatically get overwritten with each time the network is spooled up, so be sure to make copies of any log files that you wish to keep.
:::
