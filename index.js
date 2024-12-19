const shim = require("fabric-shim");
const StateMachine = require("javascript-state-machine");

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

const ProductsChaincode = class {
  constructor(cid = shim.ClientIdentity) {
    this.clientIdentity = cid;
  }
  ////////////////////////////////////////////////////////////////////////////
  // requireAffiliationAndPermissions
  // Checks that invoke() caller belongs to the specified blockchain member
  // and has the specified permission. Throws an exception if not.
  ////////////////////////////////////////////////////////////////////////////
  requireAffiliationAndPermissions(stub, affiliation, permission) {
    const cid = new this.clientIdentity(stub);
    let permissions = cid.getAttributeValue("permissions") || "default";
    permissions = permissions.split("_");
    const hasBoth =
      cid.assertAttributeValue("hf.Affiliation", affiliation) &&
      permissions.includes(permission);
    if (!hasBoth) {
      const msg =
        `Unauthorized access: affiliation ${affiliation}` +
        ` and permission ${permission} required`;
      throw new Error(msg);
    }
  }

  ////////////////////////////////////////////////////////////////////////////
  // assertCanPerformOperation
  // Determines which membership affiliations are required for which
  // operations. Called by other methods. Calls
  // requireAffiliationAndPermissions as a subroutine.
  ////////////////////////////////////////////////////////////////////////////

  assertCanPerformTransition(stub, transition) {
    let requiredAffiliation = "undefined";
    switch (transition) {
      case "manufacture":
      case "inspect":
      case "ship":
        requiredAffiliation = "Supplier";
        break;
      case "receive":
      case "label":
      case "sell":
        requiredAffiliation = "Retailer";
    }
    this.requireAffiliationAndPermissions(
      stub,
      requiredAffiliation,
      transition
    );
  }

  /**
   * Initialize the chaincode
   * @param {shim.ChaincodeStub} stub
   */
  async Init(stub) {
    console.log("=======PRODUCTS========");
    const { params } = stub.getFunctionAndParameters();

    if (params.length > 0) {
      return shim.error("Init function not expect any arguments");
    }

    await stub.putState("productIDs", Buffer.from("[]"));
    return shim.success();
  }

  /**
   * Invoke and dispatch the appropriate method
   * @param {shim.ChaincodeStub} stub
   */
  async Invoke(stub) {
    const { fcn, params } = stub.getFunctionAndParameters();

    if (!fcn) {
      return shim.error("Missing method parameter in invoke");
    }
    const method = this[fcn];

    if (method) {
      return shim.error(`Unrecognized method ${fcn} in invoke`);
    }

    try {
      const payload = await method(this, stub, params);
      console.log(`Calling to ${fcn} method`);
      return shim.success(Buffer.from(payload));
    } catch (err) {
      return shim.error(err);
    }
  }

  /**
   * Invoke and dispatch the appropriate method
   * @param {ProductsChaincode} self
   * @param {shim.ChaincodeStub} stub
   * @Param {any} args
   */
  async createProduct(self, stub, args) {
    if (args.length !== 1) {
      throw new Error("createProduct expects one argument");
    }

    self.assertCanPerformTransition(stub, "manufacture");
    const now = new Date();
    const payload = {
      state: "manufactured",
      history: {
        manufactured: now.toISOString(),
      },
    };
    const strPayload = JSON.stringify(payload);
    const productId = args[0];
    const key = `product_${productId}`;
    let productStateBytes = await stub.getState(key);

    if (!productStateBytes || productStateBytes.length === 0) {
      console.log(
        `Calling stub.putState(${key}, Buffer.from(JSON.stringify(${strPayload})))...`
      );
      await stub.putState(key, Buffer.from(strPayload));
    } else {
      throw new Error("Product with same ID already exists.");
    }

    let arr = await stub.getState("productIDs");
    let productIDs = JSON.parse(arr.toString());
    productIDs = [...productIDs, key].sort();
    await stub.putState("productIDs", Buffer.from(JSON.stringify(productIDs)));

    return strPayload;
  }

  /**
   * Invoke and dispatch the appropriate method
   * @param {ProductsChaincode} self
   * @param {shim.ChaincodeStub} stub
   * @Param {any} args
   */
  async updateProductState(self, stub, args) {
    if (args.length !== 2) {
      throw new Error("updateProductState expects two arguments");
    }
    const productId = args[0];
    const transition = args[1];

    self.assertCanPerformTransition(stub, transition);
    const key = `product_${productId}`;

    const productDataBytes = await stub.getState(key);

    if (!productDataBytes) {
      throw new Error("Product with same ID already exists.");
    }

    const productData = JSON.parse(productDataBytes.toString());
    FSM.goto(productData.state);
    FSM[transition]();
    productData.state = FSM.state;
    productData.history = productData.history || {};
    productData.history[product.state] = now.toISOString();
    const stringProductData = JSON.stringify(productData);
    await stub.putState(key, Buffer.from(stringProductData));
    return stringProductData;
  }

  async query() {
    const params = Array.from(arguments);
    let ctx,
      stub,
      args,
      keyIndex = 0,
      expectedArgLength = 1;
    if (params.length === 2) {
      // we're being called in unit tests
      [stub, args] = params;
      keyIndex = 1;
      expectedArgLength = 2;
    } else {
      // we're being called in a live environment
      [ctx, stub, args] = params;
    }
    if (args.length !== expectedArgLength) {
      throw new Error(
        `Incorrect number of arguments. Arguments contains: ${JSON.stringify(
          args
        )}`
      );
    }

    let key = args[keyIndex];

    // Get the state from the ledger
    let resultBytes = await stub.getState(key);
    if (!resultBytes) {
      const message = `No value for key ${key}`;
      throw new Error(message);
    }

    console.log("Query Response:", resultBytes.toString());
    return resultBytes;
  }
};

module.exports = ProductsChaincode;

shim.start(new ProductsChaincode());
