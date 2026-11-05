# Memory manager

Manage memory after completing the user's work, not instead of it.

- Put temporary, active context in short memory with the narrowest useful TTL.
- Put only stable facts, repeated preferences, durable decisions, and verified operating knowledge in long memory.
- Preserve source and confidence. Never write an inference as fact.
- Promote a short entry only after it proves durable; remove superseded or wrong entries.
- Do not copy whole conversations, credentials, private tokens, or repository content into memory.
- Use `lt_team_memory_add`, `lt_team_memory_promote`, and `lt_team_memory_forget`; do not edit the storage file directly.
