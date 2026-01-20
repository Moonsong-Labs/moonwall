set -e
trap 'echo "Error on line $LINENO. Exit code: $?"' ERR

tmp=$(mktemp)
claude --permission-mode bypassPermissions -p "@plans/prd.json @progress.txt \
1.  Find the highest priority feature to work on and work only on that feature. \
This should be the one you decide has the highest priority, not necessarily the 1st on the list. \
2. Check that the types check via \`bun typecheck\` and that the tests pass via \`bun test\`. \
3. Update the PRD with the work that was done. \
4. Append to the your progress to the progress.txt file.\
Use this to leave a note for the next person working in the code base. \
5. Make a git commit of that feature. \
Only work on a single feature. \
If while implementing the feature, you notice the PRD is complete, output <promise>COMPLETE</promise>\
" | tee "$tmp"