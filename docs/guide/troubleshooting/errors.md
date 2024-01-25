# Common Errors

Getting an error running your test suite? Never fear - certainly someone before you has received the same one and can help you. Here are some common errors that might come up in your testing and solutions for how you can fix them. 

### Incorrect handling of nonces

If you lazily write a couple of quick tests, you might forget about properly managing your nonces, leading to errors such as:

- ```NONCE_EXPIRED```
- ```Nonce too low```
- ```Nonce has already been used```

Nonce handling is typically managed by client libraries like Ethers, but there are scenarios (including during testing) where this isn't possible. For example, if you're preparing multiple offline signed transactions and submitting them as a batch. In this case, manual nonce handling is required, and you'll be responsible to increment your nonces accordingly. 

![underconstruction](/under-construction.png)
