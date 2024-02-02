// higher order function

// 1st way to create wrapper function using Promise
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((error) => next(error));
    }
}

export {
    asyncHandler
};

// another way to create wrapper function using async/await and try catch
// const asyncHandler = (fun) => {() => {}}
// const asyncHandler = (fun) => () => {}
// const asyncHandler = (fun) => async () => {}
/*
const asyncHandler = (fun) => async (req, res, next) => {
    try {
        await fun(req, res, next);

    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}
*/