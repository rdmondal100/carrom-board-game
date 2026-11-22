import mongoose, { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { GROUP_MAX_MEMBERS, GROUP_NAME_MAX, GROUP_NAME_MIN } from '@carrom/protocol';

/** ADDA-2 a group ("adda"). `members` counts its GroupMember rows and is the guard for the size limit. */
const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: GROUP_NAME_MIN, maxlength: GROUP_NAME_MAX },
    /** Invite code for `/a/:code`. */
    code: { type: String, required: true },
    ownerId: { type: String, required: true },
    members: { type: Number, required: true, default: 0, min: 0, max: GROUP_MAX_MEMBERS },
    /** ADDA-7 the owner closed the invite link. */
    invitesLocked: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

groupSchema.index({ code: 1 }, { unique: true });

export type GroupFields = InferSchemaType<typeof groupSchema>;
export type GroupDoc = HydratedDocument<GroupFields>;

export const Group = mongoose.model('Group', groupSchema);
