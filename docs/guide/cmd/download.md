# Download

The download CLI command allows you to quick download any necessary artifacts. 

## Parameters

- **name** - name of the artifact to download
- **version** - artifact version to download, e.g. latest. 
- **path** *string* - path to save artifacts. The default is the current directory. 
- **overwrite** *boolean* - if the file exists, should it be overwritten? Default is to override. Alias: "d"
- **output-name** *string* - Rename downloaded file to this name. Alias "o"

## Example Usage

### Downloading the Polkadot Client

```sh [moonwall]
bun moonwall download polkadot v1.5.0
```

::: tip
If you have moonwall globally installed, you can omit bun from the command and simply use `moonwall download...`
:::

### Downloading the Latest Moonbeam Client

```sh [moonwall]
bun moonwall download moonbeam latest
```
