pipeline {
    agent any
    
    environment {
        // Credential ID configured in Jenkins
        DOCKER_CREDENTIALS_ID = 'docker-hub-credentials'
        // Docker Hub Username
        REGISTRY_USER = 'lusardi1943'
        // Dynamic tag based on build number
        IMAGE_TAG = "v5.0.${BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build Docker Images') {
            steps {
                script {
                    echo 'Building Backend...'
                    // Build backend image
                    sh "docker build -t $REGISTRY_USER/atlas-cmms-backend:$IMAGE_TAG ./api"
                    
                    echo 'Building Frontend...'
                    // Build frontend image
                    sh "docker build -t $REGISTRY_USER/atlas-cmms-frontend:$IMAGE_TAG ./frontend"
                }
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                script {
                    echo 'Pushing images to Docker Hub...'
                    withCredentials([usernamePassword(credentialsId: DOCKER_CREDENTIALS_ID, usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        // Login to Docker Hub
                        sh "docker login -u $USERNAME -p $PASSWORD"
                        
                        // Push Backend
                        sh "docker push $REGISTRY_USER/atlas-cmms-backend:$IMAGE_TAG"
                        
                        // Push Frontend
                        sh "docker push $REGISTRY_USER/atlas-cmms-frontend:$IMAGE_TAG"
                    }
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    echo 'Updating Kubernetes Deployments...'
                    // Update Backend Deployment
                    sh "kubectl set image deployment/backend backend=$REGISTRY_USER/atlas-cmms-backend:$IMAGE_TAG -n atlas-cmms"
                    
                    // Update Frontend Deployment
                    sh "kubectl set image deployment/frontend frontend=$REGISTRY_USER/atlas-cmms-frontend:$IMAGE_TAG -n atlas-cmms"
                    
                    // Wait for rollout to complete
                    sh "kubectl rollout status deployment/backend -n atlas-cmms"
                    sh "kubectl rollout status deployment/frontend -n atlas-cmms"
                }
            }
        }
    }
}
