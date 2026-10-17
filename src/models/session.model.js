import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: [true, "User is required "],
  },
  refreshTokenHash: {
    type: String,
    required: [true, "Refresh token is required  "],
  },
  ip: {
    type: String,
    required: [true, "ip is required "],
  },
  userAgent: {
    type: String,
    required: [true, "User agent is reqired "],
  },
  revoked: {
    type: Boolean,
    default: false,
  }
},{
    timestamps: true
})


const sessionModel = mongoose.model("sessions",sessionSchema)

export default sessionModel;