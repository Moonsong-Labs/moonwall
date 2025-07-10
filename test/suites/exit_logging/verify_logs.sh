#!/bin/bash

# Script to verify exit logging in Moonwall log files

echo "🔍 Checking for exit log messages in node logs..."
echo "=============================================="

LOG_DIR="tmp/node_logs"

if [ ! -d "$LOG_DIR" ]; then
    echo "❌ Log directory not found: $LOG_DIR"
    echo "   Run a Moonwall test first to generate logs."
    exit 1
fi

# Find all log files
LOG_FILES=$(find "$LOG_DIR" -name "*.log" -type f 2>/dev/null)

if [ -z "$LOG_FILES" ]; then
    echo "❌ No log files found in $LOG_DIR"
    exit 1
fi

echo "Found log files:"
echo "$LOG_FILES"
echo ""

# Check each log file for exit messages
for LOG_FILE in $LOG_FILES; do
    echo "📄 Checking: $LOG_FILE"
    echo "----------------------------------------"
    
    # Look for exit messages at the end of the file
    TAIL_LINES=$(tail -n 20 "$LOG_FILE")
    
    # Check for exit code logging
    if echo "$TAIL_LINES" | grep -q "\[moonwall\] process exited with status code"; then
        echo "✅ Found exit code logging:"
        echo "$TAIL_LINES" | grep "\[moonwall\] process exited with status code"
    fi
    
    # Check for termination reason logging
    if echo "$TAIL_LINES" | grep -q "\[moonwall\] process killed. reason:"; then
        echo "✅ Found termination reason logging:"
        echo "$TAIL_LINES" | grep "\[moonwall\] process killed. reason:"
    fi
    
    # Check for signal termination logging
    if echo "$TAIL_LINES" | grep -q "\[moonwall\] process terminated by signal"; then
        echo "✅ Found signal termination logging:"
        echo "$TAIL_LINES" | grep "\[moonwall\] process terminated by signal"
    fi
    
    # If no exit messages found
    if ! echo "$TAIL_LINES" | grep -q "\[moonwall\]"; then
        echo "⚠️  No exit logging found at end of file"
        echo "   Last few lines:"
        tail -n 5 "$LOG_FILE" | sed 's/^/   /'
    fi
    
    echo ""
done

echo "=============================================="
echo "💡 Tip: To see the full end of a log file, use:"
echo "   tail -n 50 <log_file>"