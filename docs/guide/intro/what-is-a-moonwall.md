# A Primer on Moonwall 🌕️

## Why did we build this?

There are a very many, probably too many, Javascript libraries in the world.
Why would we need yet another one, except with the niche use case of blockchains?
It is a good question, one which this page will hopefully try to answer.

## Multiple Types of Testing Required

For anyone who is familiar with the best Software Development practises, there is [no single type](https://martinfowler.com/articles/practical-test-pyramid.html)
of software testing that finds all bugs. Instead the approach to use is to have multiple types of testing
in a variety of environment configurations, for as many scenarios as supportable, to produce a
multi-tiered defence against software defects creeping into your code. 

This is all standard software dev practise but the problems creep in because of the *web-centric tech stack that blockchain projects often employ.*

## The Problem with existing products

At their core, blockchains are a consensus system that share state - which is typically produced by node binaries, based on transactions they receive. 
Depending on the functionality you are looking to verify (be that: networking between nodes, state transition logic, RPC endpoints), you will execute tests localized 
to that particular area.

*The problem is that ubiquitous tooling to support this doesn't yet exist.*

### Blockchain Test Frameworks

Very popular libraries like [foundry](https://github.com/foundry-rs/foundry), [hardhat](https://github.com/NomicFoundation/hardhat), truffle, brownie; are all written from a smart contract developer point of view.
They purposefully hide information about the underlying workings (in this case the EVM), to make it easier for smart contract developers - which is not helpful for teams
looking to test their node software. Moonwall can help fix this void. 

### Web Test Frameworks

Of the available web test frameworks, to name but a few: `vitest`, `mocha`, `ava`, `playwright`, `jest`; they are written either for the browser or for interacting with webservers.
The assumptions made about state are fundamentally incompatible with blockchain testing, so are inappropriate for off-the-shelf use.

## What are we trying to accommodate?

### Combined Config

The goal is to dramatically help with environment configuration, to reduce friction in reproducing an error or tracking down a defect. Given that blockchains are so 
idiosyncratic and complex - configuring these networks are a great source of pain. Moonwall attempts to allieviate this as much as possible by providing a single venue to
look how environments are configured - without having to search the code for esoteric flags, options or environment variables.

### User-chosen Clients

Depending on the nature of your blockchain, some clients might make more sense than others. For example, for a non-EVM compatible chain you would have no need for `Ethers.js`.
As new and better clients come out, we wish to be able to support them without large amounts of refactors or breaking changes.

### Reduced boilerplate

When developing a brand new chain, you will want to start with the basic interactions and iteratively add to your coverage as and when more complex functions become available.
By providing wrappers and functions to house those fundamental interactions (deploying contracts, creating blocks, performing queries), as and when refactors happen you will have far less code to rewrite.

Refactoring is important and it should never be disincentivised, especially on blockchains where security is **the** most important factor. Reducing test boilerplate goes a 
long way to reducing pain when interfaces change.

## Parting Remarks

As you can hopefully see, given there are no obvious candidates for a single test framework to use, it would make sense to create Moonwall. Where possible, we would wrap other frameworks
but with the ability to pick and choose the parts we needed and to arrange them in such a way they would be appropriate for deep blockchain testing. 

🧪 If this is something that interests you, please navigate to the next page to find out more!
