// Big flat payout, then permanently destroys itself — see 9juli_destroy-ability-draft.md.
export function jackpotEffect(_cap, _ctx) {
    return { baseValue: 50, destroySelf: true };
}
