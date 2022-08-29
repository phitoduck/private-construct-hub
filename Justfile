deploy:
    # aws ecr get-login-password --region us-east-1 --profile ben-ai-sandbox | docker login --username AWS --password-stdin 785465075102.dkr.ecr.us-east-1.amazonaws.com \
    # && docker pull public.ecr.aws/amazonlinux/amazonlinux:2
    
    docker logout public.ecr.aws && docker pull public.ecr.aws/amazonlinux/amazonlinux:2