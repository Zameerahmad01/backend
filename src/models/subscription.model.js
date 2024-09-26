import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, // This is the user who is subscribing
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId, // This is the channel that is being subscribed to
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
