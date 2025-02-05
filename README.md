# apricot 
Calculates what the API costs would have been if you'd used the API for historic Claude chat app conversations instead.

For now, it only works for Claude data exports. Via the chat app, request a data export and you'll receive a file name `conversations.json` within an hour. Put that in the root redirectory of this repo.

Then you can parse it to see how many conversations you have:

  $node apricot.js conversations.json
  7

## List the conversations with their prices

  ```$node apricot.js -l conversations.json
  1  "Obtaining a Municipal Address History Extract in 's-Hertogenbosch" $0.00
  2  "European Countries Not in the Council of Europe" $0.03
  3  "Checking 5G Support on Samsung Galaxy S20" $0.11
  4  "Proper Use of Appositives" $0.02
  5  "Efficiency Limits of Electric Heaters" $0.02
  6  "Countries Completely Surrounded by One Other Country" $0.01
  7  "Calculating Square Root of Unsigned Long Long in C" $0.00```

## Detailed breakdown of input and output tokens for a specific conversation

  ```$node apricot.js -t -n 6 conversations.json
  6  "Countries Completely Surrounded by One Other Country" $0.01
    human: msg=12 input=12 output=0 acc-input=12 acc-output=0
    assistant: msg=149 input=0 output=149 acc-input=12 acc-output=149
    human: msg=8 input=169 output=0 acc-input=181 acc-output=149
    assistant: msg=262 input=0 output=262 acc-input=181 acc-output=411
    costs: input=$3/MTok output=$15/MTok input-costs=$0.00 output-costs=$0.01 total-cost=$0.01```

## See the total cost of all your conversations

  ```$node apricot.js -t conversations.json
  Total costs:
    input: $3/MTok
    output: $15/MTok
    input tokens: 8,681,698
    input costs: $26.05
    output tokens: 247,014
    output costs: $3.71
    total costs: $29.75```

## Change the price of the tokens from the defaults if you need to

  ```$node apricot.js -h
  
  Usage: exparse [-hlv] [-n N] [-i C] [-o C] [-t] conversations.json
  
  Options:
    -h, --help            Show this help message
    -l                    List conversations
    -v                    Verbose output
    -n N                  Only display conversation N
    -i C                  Cost per million input tokens (default: 3)
    -o C                  Cost per million output tokens (default: 15)
    -t                    Show token cost details (implies -l)
  
  With no flags, displays total number of conversations.
  With -l flag, lists numbered conversations.
  With -lv flags, lists conversations with details.```
