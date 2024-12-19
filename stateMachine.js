const StateMachine = require('javascript-state-machine');

const FSM = new StateMachine({
  init: "manufactured",
  transitions: [
    { name: "inspect", from: "manufactured", to: "inspected" }, // supplier
    { name: "ship", from: "inspected", to: "shipped" }, // supplier
    { name: "receive", from: "shipped", to: "stocked" }, // retailer
    { name: "label", from: "stocked", to: "labeled" }, // retailer
    { name: "sell", from: "labeled", to: "sold" }, // retailer
    {
      name: "goto",
      from: "*",
      to: function (s) {
        return s;
      },
    },
  ],
});

console.log(FSM.state);

console.log(FSM.goto('manufactured'));

console.log(FSM['inspect']());

console.log(FSM.state);
