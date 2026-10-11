#!/bin/bash
pkill socat || true
pkill -f "kubectl port-forward" || true

WEB_IP=$(k3s kubectl get svc web -n crewrescue -o jsonpath="{.spec.clusterIP}")
API_IP=$(k3s kubectl get svc api -n crewrescue -o jsonpath="{.spec.clusterIP}")

nohup socat TCP4-LISTEN:5173,bind=0.0.0.0,fork,reuseaddr TCP:$WEB_IP:80 &>/dev/null &
nohup socat TCP4-LISTEN:5000,bind=0.0.0.0,fork,reuseaddr TCP:$API_IP:5000 &>/dev/null &
