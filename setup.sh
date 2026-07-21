#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to get current branch name
get_current_branch() {
    git branch --show-current
}

# Function to prompt yes/no
prompt_yes_no() {
    while true; do
        read -p "$1 [y/n]: " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Function to push changes with retries
push_with_retry() {
    local branch=$1
    local attempt=1
    local max_attempts=3

    while [ $attempt -le $max_attempts ]; do
        echo -e "${YELLOW}Attempt $attempt of $max_attempts: Pushing to ${branch}...${NC}"
        if git push -u origin "$branch"; then
            echo -e "${GREEN}Push to ${branch} successful!${NC}"
            return 0
        fi

        ((attempt++))
        if [ $attempt -le $max_attempts ]; then
            echo -e "${YELLOW}Push failed. Retrying in 3 seconds...${NC}"
            sleep 3
        fi
    done

    echo -e "${RED}Failed to push after ${max_attempts} attempts.${NC}"
    return 1
}

# Initialize Git if not already
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initializing new Git repository...${NC}"
    git init
    # Create initial commit if empty repo
    if [ -z "$(git branch --list)" ]; then
        git commit --allow-empty -m "Initial commit"
    fi
else
    echo -e "${GREEN}Existing Git repository found.${NC}"
fi

# Remote handling
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)

if [ -z "$CURRENT_REMOTE" ]; then
    read -p "Enter remote repository URL (e.g., git@github.com:user/repo.git): " REMOTE_URL
    echo -e "${YELLOW}Setting up new remote repository...${NC}"
    git remote add origin "$REMOTE_URL"
else
    echo -e "${GREEN}Remote already configured: ${CURRENT_REMOTE}${NC}"
    if prompt_yes_no "Do you want to change the remote URL?"; then
        read -p "Enter new remote repository URL: " REMOTE_URL
        git remote set-url origin "$REMOTE_URL"
        echo -e "${YELLOW}Remote URL updated to:${NC} $REMOTE_URL"
    fi
fi

# Get current branch name
CURRENT_BRANCH=$(get_current_branch)
if [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_BRANCH="main"
    git checkout -b "$CURRENT_BRANCH" 2>/dev/null || true
fi

# Check for changes
CHANGES_EXIST=$(git status --porcelain)
if [ -n "$CHANGES_EXIST" ]; then
    echo -e "${YELLOW}The following changes were detected:${NC}"
    git status -s

    if prompt_yes_no "Do you want to stage all changes?"; then
        git add .

        echo -e "${YELLOW}Staged changes:${NC}"
        git status -s

        if prompt_yes_no "Do you want to commit these changes?"; then
            read -p "Enter commit message: " COMMIT_MSG
            git commit -m "$COMMIT_MSG"

            # Push with retry logic
            while true; do
                if push_with_retry "$CURRENT_BRANCH"; then
                    break
                else
                    if push_with_retry "main"; then
                        break
                    else
                        echo -e "${RED}All push attempts failed.${NC}"
                        if prompt_yes_no "Do you want to try pushing again?"; then
                            continue
                        else
                            echo -e "${YELLOW}Changes were committed but not pushed.${NC}"
                            if prompt_yes_no "Do you want to exit without pushing?"; then
                                exit 1
                            fi
                        fi
                    fi
                fi
            done
        else
            echo -e "${YELLOW}Changes staged but not committed.${NC}"
        fi
    else
        echo -e "${RED}Changes not staged.${NC}"
    fi
else
    echo -e "${GREEN}No changes detected.${NC}"

    if prompt_yes_no "Do you want to pull from remote?"; then
        if ! git pull origin "$CURRENT_BRANCH"; then
            echo -e "${YELLOW}Failed to pull ${CURRENT_BRANCH}. Trying 'main'...${NC}"
            git pull origin main
        fi
    fi
fi

# Final verification
if git ls-remote --exit-code origin &>/dev/null; then
    echo -e "${GREEN}Repository synchronized successfully!${NC}"
    echo -e "Current branch: ${YELLOW}$(get_current_branch)${NC}"
    echo -e "Remote URL: ${YELLOW}$(git remote get-url origin)${NC}"
    echo -e "Latest commit: ${YELLOW}$(git log -1 --pretty=%B)${NC}"
else
    echo -e "${RED}Warning: Could not verify remote repository connection.${NC}"
    exit 1
fi