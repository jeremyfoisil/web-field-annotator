FROM nginx:1.28

# Copy src
COPY --chown=nginx:nginx jenkins_release/field_annotator /home/www
COPY --chown=root:root cicd/build/docker-prod/web/nginx.conf /etc/nginx/conf.d/default.conf
