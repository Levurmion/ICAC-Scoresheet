import { Match, PublicMatch, RestrictedMatch } from "./types";

export default function isRestrictedMatch(match: Match): match is RestrictedMatch {
    return (match as RestrictedMatch).whitelist !== undefined
}