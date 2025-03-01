const { ObjectID } = require('mongodb');
const model = require('../models/orders');
const pModel = require('../models/products');

const insertProducts = (res, next, query) => {
  model
    .orders()
    .findOne(query)
    .then(order => {
      if (!order) {
        next(404);
      } else {
        pModel
          .products()
          .find({ _id: { $in: order.products.map(p => p.productId) } })
          .toArray()
          .then(products => {
            order.products = order.products.map(orderP => ({
              qty: orderP.qty,
              product: products.find(p => p._id.equals(orderP.productId))
            }));
            res.send(order);
          });
      }
    });
};

module.exports = {
  createOrder: (req, res, next) => {
    const { userId, client, products } = req.body;
    if (!userId || !products) {
      next(400);
    } else {
      const order = {
        userId,
        client,
        products: products.map(p => ({
          productId: new ObjectID(p.productId),
          qty: p.qty
        })),
        status: 'pending',
        dateEntry: new Date(),
        dateProcessed: ''
      };

      model.orders().insertOne(order, (err, result) => {
        if (!err) {
          insertProducts(res, next, { _id: new ObjectID(result.ops[0]._id) });
        }
      });
    }
  },
  getOrders: (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    const page = parseInt(req.query.page, 10) || 1;
    model.orders().countDocuments((err, count) => {
      const numberPages = Math.ceil(count / limit);
      const skip = numberPages === 0 ? 1 : (numberPages - 1) * limit;

      model
        .orders()
        .find()
        .skip(skip)
        .limit(limit)
        .toArray((error, orders) => {
          if (!error) {
            const firstPage = `</products?limit=${limit}&page=${1}>; rel="first"`;
            const prevPage = `</products?limit=${limit}&page=${page -
              1}>; rel="prev"`;
            const nextPage = `</products?limit=${limit}&page=${page +
              1}>; rel="next"`;
            const lastPage = `</products?limit=${limit}&page=${numberPages}>; rel="last"`;

            res.setHeader(
              'link',
              `${firstPage}, ${prevPage}, ${nextPage}, ${lastPage}`
            );
            res.send(orders);
          }
        });
    });
  },
  getOrderById: (req, res, next) => {
    const hex = /[0-9A-Fa-f]{6}/g;
    const reqParam = req.params.orderid;
    const query = hex.test(reqParam)
      ? { _id: new ObjectID(reqParam) }
      : { _id: reqParam };
    insertProducts(res, next, query);
  },
  putOrderById: (req, res, next) => {
    const hex = /[0-9A-Fa-f]{6}/g;
    const reqParam = req.params.orderid;
    const query = hex.test(reqParam)
      ? { _id: new ObjectID(reqParam) }
      : { _id: reqParam };
    const { userId, client, products, status } = req.body;

    if (!req.body) {
      return next(400)
    } else if (!userId && !client && !products && !status) {
      return next(400)
    }
    else if (status !== 'canceled' && status !== 'delivered' && status !== 'delivering' && status !== 'pending' && status !== 'preparing'){
      return next(400);
    } else{

    model.orders().findOne(query).then(order => {
        if (!order) {
          return next(404);
        } else {
          model.orders().findAndModify(
            query,
            [],
            {
              $set: {
                products: products || order.products,
                status: status || order.status,
                dateProcessed:
                  status === 'delivered' ? new Date() : order.dateProcessed
              }
            },
            { new: true },
            (err, result) => {
              if (!err) {
                return res.send(result.value);
              }
            }
          );
        }
      });
    }
  },
  deleteOrderById: (req, res, next) => {
    const hex = /[0-9A-Fa-f]{6}/g;
    const reqParam = req.params.orderid;
    const query = hex.test(reqParam)
      ? { _id: new ObjectID(reqParam) }
      : { _id: reqParam };

    model
      .orders()
      .findOne(query)
      .then(order => {
        if (!order) {
          next(404);
        } else {
          model.orders().deleteOne({ _id: order._id }, err => {
            if (!err) {
              res.send(order);
            }
          });
        }
      });
  }
};
