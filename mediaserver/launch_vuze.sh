#!/usr/bin/env bash

# Based on https://gist.githubusercontent.com/dpino/6c0dca1742093346461e11aa8f608a99/raw/aeb3c026799587cafbc4dc099c66091e9d27b53f/ns-inet.sh

set -ex

# The following account must exist.
USERNAME="media"
HOMEDIR="/srv/media"

# The IP address of the I2P router.
I2PROUTER="10.0.0.1"

# The rest of these variables are arbitrary and should not be important.
XDISPLAY=20
ETH="br0"
NS="vuze0"
VETH="veth0"
VPEER="veth1"
VETH_ADDR="192.168.42.1"
VPEER_ADDR="192.168.42.2"

if [[ $EUID -ne 0 ]]; then
    echo "You must be root to run this script"
    exit 1
fi

killall Xvfb || true

# Clean up namespace and links.
ip netns del ${NS} || true
ip link del ${VETH} || true
ip link del ${VPEER} || true
sleep 1

# Create namespace
ip netns add $NS

# Create veth link.
ip link add ${VETH} type veth peer name ${VPEER}

# Add peer-1 to NS.
ip link set ${VPEER} netns $NS

# Setup IP address of ${VETH}.
ip addr add ${VETH_ADDR}/24 dev ${VETH}
ip link set ${VETH} up

# Setup IP ${VPEER}.
ip netns exec $NS ip addr add ${VPEER_ADDR}/24 dev ${VPEER}
ip netns exec $NS ip link set ${VPEER} up
ip netns exec $NS ip link set lo up
ip netns exec $NS ip route add default via ${VETH_ADDR}

# Enable IP-forwarding.
echo 1 > /proc/sys/net/ipv4/ip_forward

# Flush forward rules.
iptables -P FORWARD DROP
iptables -F FORWARD
 
# Flush nat rules.
iptables -t nat -F

# Enable masquerading.
iptables -t nat -A POSTROUTING -s ${VPEER_ADDR}/24 -o ${ETH} -j MASQUERADE
 
iptables -A FORWARD -i ${ETH} -o ${VETH} -j ACCEPT
iptables -A FORWARD -o ${ETH} -i ${VETH} -j ACCEPT

# Isolate the namespace
ip netns exec ${NS} iptables -P INPUT ACCEPT
ip netns exec ${NS} iptables -P FORWARD DROP
ip netns exec ${NS} iptables -P OUTPUT DROP
# Allow pings
ip netns exec ${NS} iptables -A OUTPUT -p icmp -j ACCEPT
# Allow TCP X11 traffic to the local host only
ip netns exec ${NS} iptables -A OUTPUT -p tcp -d ${VETH_ADDR} --dport $(echo "6000 ${XDISPLAY} +p" | dc)  -j ACCEPT
# DNS (optional, only enable for troubleshooting)
# Rationale: Vuze doesn't need DNS when limited to using I2P and Tor (via Orchid).
# 1. Public tracker scrapes will go through Tor via I2P SOCKS proxy and Orchid.
# 2. Although Tor cannot route UDP packets, Tor exit node will resolve public DNS for HTTP requests.
# 3. All peer communication in this configuration is done via 1) I2P or Tor onion address or 2) public IP address, not DNS name.
# Blocking DNS prevents Vuze discovering its external IP address via a public
# DNS query and then potentially leaking it.
#ip netns exec ${NS} iptables -A OUTPUT -d ${I2PROUTER} -p udp --dport 53 -j ACCEPT
# I2P I2CP (for I2P DHT)
ip netns exec ${NS} iptables -A OUTPUT -d ${I2PROUTER} -p tcp --dport 7654 -j ACCEPT
# I2P router console
ip netns exec ${NS} iptables -A OUTPUT -d ${I2PROUTER} -p tcp --dport 7657 -j ACCEPT
# I2P SOCKS
ip netns exec ${NS} iptables -A OUTPUT -d ${I2PROUTER} -p tcp --dport 14447 -j ACCEPT
ip netns exec ${NS} iptables -A OUTPUT -s 127.0.0.0/8 -j ACCEPT
ip netns exec ${NS} iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
# I2P HTTP/HTTPS proxy (not sure this is needed - remove if not)
#ip netns exec ${NS} iptables -A OUTPUT -d ${I2PROUTER} -p tcp --dport 4444 -j ACCEPT
#ip netns exec ${NS} iptables -A OUTPUT -d ${I2PROUTER} -p tcp --dport 4445 -j ACCEPT

# Start up Xvfb
echo "Waiting for Xvfb startup..."
rm -f /tmp/.X11-unix/X${XDISPLAY}
nohup runuser -u ${USERNAME} -- /usr/bin/xvfb-run -l -a -f ${HOMEDIR}/.Xauthority -n ${XDISPLAY} -s "-screen 0 1024x768x24" fluxbox > ${HOMEDIR}/nohup.out &
while [ ! -S "/tmp/.X11-unix/X${XDISPLAY}" ]; do sleep 1; done

# Allow x0vncserver and other X clients to connect
export DISPLAY=:${XDISPLAY}
export XAUTHORITY=${HOMEDIR}/.Xauthority
# Only need this if UNIX socket doesn't work
#xhost +${VPEER_ADDR}
#export DISPLAY=${VETH_ADDR}:${XDISPLAY}

# Start up x0vncserver
nohup runuser -u ${USERNAME} -- /usr/bin/x0vncserver -display :${XDISPLAY} -rfbport $(echo "5900 ${XDISPLAY} +p" | dc) -passwordfile ${HOMEDIR}/.vnc/passwd >> ${HOMEDIR}/nohup.out &

# Wait for x0vncserver to quiesce (port-check if this doesn't work)
sleep 3

# Start up Vuze
ulimit -n 16384
nohup ip netns exec ${NS} runuser -u ${USERNAME} -- sh -c "DISPLAY=:${XDISPLAY} /usr/bin/azureus" >> ${HOMEDIR}/nohup.out &

# Launch shell in namespace (for interactive debugging)
#ip netns exec ${NS} /bin/bash --rcfile <(echo "PS1=\"${NS}> \"")

