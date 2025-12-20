const sellerGuard = (req, res, next) => {
    const sellerStatus = req.user?.marketplace?.sellerStatus || 'none';

    if (sellerStatus !== 'approved') {
        return res.status(403).json({
            success: false,
            message: 'Seller account not approved'
        });
    }

    next();
};

module.exports = sellerGuard;