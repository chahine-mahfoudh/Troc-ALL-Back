const mongoose = require("mongoose")

const PostSchema = new mongoose.Schema(
    {
        name: {type: String},
        description: {type: String},
        date: {type: Date, default: Date.now},
        imageFilename: {type: String},
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        likes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Like"
        }],
        comments: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }],
    },
    {
        timestamps: {currentTime: () => Date.now()},
    }
)

module.exports = mongoose.model("Post", PostSchema)
