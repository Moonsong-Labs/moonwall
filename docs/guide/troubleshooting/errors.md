# Common Errors

Getting an error running your test suite? Never fear - certainly someone before you has received the same one and can help you. Here are some common errors that might come up in your testing and solutions for how you can fix them. 

## Common Errors and How to Address Them

```bash
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  
Command was killed with SIGINT (User interruption with CTRL-C): moonwall
```

This just means that you didn't gracefully quit Moonwall and instead used Control-C to close out. While it looks like it's shouting at you, it's not a problem. 


### Incorrect handling of nonces

If you lazily write a couple of quick tests, you might forget about properly managing your nonces, leading to errors such as:

- ```NONCE_EXPIRED```
- ```Nonce too low```
- ```Nonce has already been used```

Nonce handling is typically managed by client libraries like Ethers, but there are scenarios (including during testing) where this isn't possible. For example, if you're preparing multiple offline signed transactions and submitting them as a batch. In this case, manual nonce handling is required, and you'll be responsible to increment your nonces accordingly. 
